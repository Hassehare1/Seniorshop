import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
import { customerTypeLabels, customerTypeChartColors } from "@/lib/customerTypes";
import { sumMoney, toNumber } from "@/lib/fees";
import WeeklyReportList from "./WeeklyReportList";
import ReportNudge from "./ReportNudge";
import GoalTracker from "./GoalTracker";
import GoalOverview from "./GoalOverview";
import SalesAnalytics, { type BreakdownItem } from "./SalesAnalytics";
import ShowTypeAnalytics, { type ShowTypeItem } from "./ShowTypeAnalytics";
import SeasonSwitcher from "./SeasonSwitcher";
import DistrictSwitcher from "./DistrictSwitcher";
import ForecastCard, { type ForecastData, type ForecastSeason, type SeasonStatus } from "./ForecastCard";
import { resolveOverviewPeriod, type SeasonRow } from "@/lib/season";
import { THEME_COOKIE, THEME_ACCENT, isTheme, DEFAULT_THEME } from "@/lib/theme";
import {
  TYPE_KEYS,
  aggregateByDistrict,
  aggregateByType,
  goalActualsFrom,
  uniqueWeeks,
  type DistAgg,
  type TypeAgg,
} from "@/lib/insights/aggregate";
import { loadSeasonReports, toAggregateInput } from "@/lib/insights/load";

// Måndagen i en given ISO-vecka (UTC). Används för att avgöra om en säsong är
// avslutad, pågående eller kommande i förhållande till dagens datum — ISO-vecka
// 1 är veckan som innehåller 4 januari.
function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // 0 = måndag
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Dow + (week - 1) * 7);
  return monday;
}

// Fjolårets motsvarighet till den valda perioden — samma säsongstyp ett år
// tidigare, eller (för helår) båda det årets säsonger. Egen funktion eftersom
// den används både för år-mot-år-kurvan här och skulle annars upprepas.
function findPrevSeasonIds(
  period: ReturnType<typeof resolveOverviewPeriod>,
  allSeasons: SeasonRow[],
): string[] {
  if (!period) return [];
  if (period.kind === "season") {
    const prev = allSeasons.find(s => s.type === period.type && s.year === period.year - 1);
    return prev ? [prev.id] : [];
  }
  return allSeasons.filter(s => s.year === period.year - 1).map(s => s.id);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; district?: string }>;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const { season: seasonParam, district: districtParam } = await searchParams;
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME;

  const allSeasons = await prisma.season.findMany({
    orderBy: [{ year: "desc" }, { type: "desc" }],
  });

  // Uttrycklig period i URL:en väger tyngst, därefter det ihågkomna valet
  // (kakan väljaren satte senast), annars nyaste säsongen. "Helår" (helar:2026)
  // är inget som lagras — det slår ihop Vår och Höst av samma år, se lib/season.
  const period = resolveOverviewPeriod(allSeasons, seasonParam, cookieStore.get("seniorshop_season")?.value);
  const seasonLabel = period?.label ?? "–";
  const periodValue = period ? (period.kind === "season" ? period.id : `helar:${period.year}`) : "";

  // Admin kan filtrera per distrikt
  const allDistricts = isAdmin
    ? await prisma.district.findMany({ orderBy: { number: "asc" }, select: { id: true, number: true, name: true } })
    : [];
  const selectedDistrictId = isAdmin
    ? (districtParam ?? cookieStore.get("seniorshop_district")?.value ?? null)
    : (session?.user?.districtId ?? null);

  type ReportRow = {
    id: string; week: number; status: string;
    // Vilken riktig säsong veckan hör till — ett helår blandar Vår och Höst,
    // så redigeringslänken (i WeeklyReportList) kan inte utgå från en enda
    // säsong för hela listan.
    seasonId: string;
    districtNumber: number; districtName: string;
    totalSales: number; totalToPay: number; totalCustomers: number;
    visitCount: number;
    // Utelämnas i admins vy över alla distrikt — där hämtar listan besöken
    // per rad först vid expand, annars växer payloaden med varje ny FT.
    // ftFee/mfFee följer bara med för admin — FT ska inte kunna läsa avgifterna
    // ur sidans data, inte heller via utvecklarverktygen.
    visits?: { id: string; customerName: string; customerType: string; numberOfCustomers: number; sales: number; isFashionShow: boolean; isHangerShow: boolean; ftFee?: number; mfFee?: number; totalToPay: number; comment: string | null }[];
  };

  const stats = {
    weeks: [] as number[],
    byType: [] as TypeAgg[],
    byDistrict: [] as DistAgg[],
    reports: [] as ReportRow[],
    showType: [] as ShowTypeItem[],
  };

  // Admin utan valt distrikt → bryt ned per distrikt i stället för kundtyp
  const showDistrictBreakdown = isAdmin && !selectedDistrictId;

  if (period) {
    const reports = await loadSeasonReports({
      seasonId: period.seasonIds,
      districtId: selectedDistrictId,
    });

    // Unika veckor — flera distrikt kan rapportera samma vecka (en rapport per
    // distrikt × vecka); utan dedup dubbleras x-axeln och staplarna splittras.
    // Ett helår krockar aldrig här: Vår och Höst har separata veckospann.
    stats.weeks = uniqueWeeks(reports);
    stats.reports = reports.map(r => ({
      id: r.id,
      week: r.week,
      status: r.status,
      seasonId: r.seasonId,
      districtNumber: r.district.number,
      districtName: r.district.name,
      totalSales: toNumber(sumMoney(r.visits.map(v => v.sales))),
      totalToPay: toNumber(sumMoney(r.visits.map(v => v.totalToPay))),
      totalCustomers: r.visits.reduce((s, v) => s + v.numberOfCustomers, 0),
      visitCount: r.visits.length,
      // Ett distrikt i taget är en hanterbar mängd och går snabbast att skicka
      // med direkt. Över alla distrikt hämtas de per rad i stället.
      ...(showDistrictBreakdown ? {} : {
        visits: r.visits.map(v => ({
          id: v.id,
          customerName: v.customer.name,
          customerType: v.customer.type,
          numberOfCustomers: v.numberOfCustomers,
          sales: toNumber(v.sales),
          isFashionShow: v.isFashionShow,
          isHangerShow: v.isHangerShow,
          ...(isAdmin && { ftFee: toNumber(v.ftFee), mfFee: toNumber(v.mfFee) }),
          totalToPay: toNumber(v.totalToPay),
          comment: v.comment,
        })),
      }),
    }));

    // Presentationsaggregat: varje term är ett exakt öresbelopp, summan visas i
    // hela kronor. Det bindande beloppet är redan lagrat exakt.
    const aggInput = toAggregateInput(reports);

    const { byType, showType } = aggregateByType(aggInput, stats.weeks);
    stats.byType = byType;
    stats.showType = TYPE_KEYS
      .map(k => ({
        key: k,
        label: customerTypeLabels[k] ?? k,
        color: customerTypeChartColors[k] ?? "#64748b",
        categories: showType[k],
      }))
      .filter(i => i.categories.modevisning.besok + i.categories.galge.besok + i.categories.ovriga.besok > 0);

    // Per distrikt (endast för admin-översikt över alla distrikt)
    if (showDistrictBreakdown) {
      stats.byDistrict = aggregateByDistrict(aggInput, stats.weeks);
    }
  }

  // Mål och uppföljning per FT (valt distrikt × säsong). Visas för FT alltid,
  // för admin bara när ett specifikt distrikt är valt. Mål är satta per
  // säsong i grunden (SeasonGoal), inte per helår — att summera Vår- och
  // Höst-mål vore en gissning om vad "helårsmål" ska betyda. Enklare och
  // ärligare att bara visa dem i Vår/Höst-läge och säga det rakt ut annars.
  const showGoals = !!(selectedDistrictId && period && period.kind === "season");
  const seasonGoal = showGoals && period && period.kind === "season"
    ? await prisma.seasonGoal.findUnique({
        where: { districtId_seasonId: { districtId: selectedDistrictId!, seasonId: period.id } },
      })
    : null;
  const goalActuals = goalActualsFrom(stats.byType);

  // Samlad mål-översikt för admin i alla-distrikt-vyn: alla FT:ers mål vs utfall.
  const showGoalOverview = isAdmin && !selectedDistrictId && !!period && period.kind === "season";
  let goalOverview: {
    districtId: string;
    label: string;
    number: number;
    goal: { salesTarget: number; visitsTarget: number; avgPerVisitTarget: number; fashionShowsTarget: number };
    actual: { sales: number; visits: number; avgPerVisit: number; fashionShows: number };
  }[] = [];
  if (showGoalOverview && period && period.kind === "season") {
    const goals = await prisma.seasonGoal.findMany({
      where: { seasonId: period.id },
      include: { district: { select: { number: true, name: true } } },
    });
    const actualByDistrict = new Map(stats.byDistrict.map(d => [d.id, d]));
    goalOverview = goals
      .map(g => {
        const a = actualByDistrict.get(g.districtId);
        const sales = a?.sales ?? 0;
        const visits = a?.besok ?? 0;
        return {
          districtId: g.districtId,
          label: `D${g.district.number} – ${g.district.name}`,
          number: g.district.number,
          goal: { salesTarget: g.salesTarget, visitsTarget: g.visitsTarget, avgPerVisitTarget: g.avgPerVisitTarget, fashionShowsTarget: g.fashionShowsTarget },
          actual: { sales, visits, avgPerVisit: visits > 0 ? sales / visits : 0, fashionShows: a?.fashionShows ?? 0 },
        };
      })
      .sort((x, y) => x.number - y.number);
  }

  // År-mot-år: fjolårets motsvarighet till den valda perioden (samma säsongstyp,
  // eller för helår båda det årets säsonger) för samma urval.
  const prevSeasonIds = findPrevSeasonIds(period, allSeasons);
  const prevLabel = period
    ? period.kind === "season"
      ? `${period.type === "VAR" ? "Vår" : "Höst"} ${period.year - 1}`
      : `Helår ${period.year - 1}`
    : "";
  let prevSeason: { label: string; weekly: { week: number; sales: number }[] } | null = null;
  if (prevSeasonIds.length > 0) {
    const prevReports = await prisma.weeklyReport.findMany({
      where: { seasonId: { in: prevSeasonIds }, ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}) },
      include: { visits: { select: { sales: true } } },
    });
    if (prevReports.length > 0) {
      const byWeek = new Map<number, number>();
      for (const r of prevReports) {
        const s = toNumber(sumMoney(r.visits.map(v => v.sales)));
        byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + s);
      }
      prevSeason = {
        label: prevLabel,
        weekly: [...byWeek.entries()].map(([week, sales]) => ({ week, sales })).sort((a, b) => a.week - b.week),
      };
    }
  }

  // Helårsprognos (FY): per säsong, kund-mot-kund mot fjolår. Ett helår = Vår +
  // Höst. En kund som redan besökts i en säsong räknas på faktiskt utfall; en
  // som ännu inte besökts prognostiseras på samma kunds utfall i motsvarande
  // säsong fjolåret. Avslutad säsong prognostiserar inte (utfallet är facit).
  // Oberoende av om Översikten just nu visar Vår, Höst eller Helår — kortet
  // rör alltid hela kalenderåret period.year.
  let forecastData: ForecastData | null = null;
  if (period) {
    const fyYear = period.year;
    const slots = [
      { type: "VAR" as const, label: "Vår" },
      { type: "HOST" as const, label: "Höst" },
    ];
    const thisYearRec = slots.map(sl => allSeasons.find(s => s.type === sl.type && s.year === fyYear));
    const lastYearRec = slots.map(sl => allSeasons.find(s => s.type === sl.type && s.year === fyYear - 1));
    const relevantIds = [...thisYearRec, ...lastYearRec]
      .filter((s): s is (typeof allSeasons)[number] => !!s)
      .map(s => s.id);

    if (relevantIds.length > 0) {
      const fyReports = await prisma.weeklyReport.findMany({
        where: { seasonId: { in: relevantIds }, ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}) },
        include: { visits: { select: { sales: true, customerId: true, customer: { select: { active: true } } } } },
      });
      // Aktiva kunder i urvalet — nämnare för "X av Y besökta". Approval-state
      // används inte: en oapprovad kund ska inte kunna dölja täckningsgraden.
      const totalCustomers = await prisma.customer.count({
        where: { active: true, ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}) },
      });

      const seasonById = new Map(allSeasons.map(s => [s.id, s]));
      // Per slot (0 = Vår, 1 = Höst): utfall i år resp. fjolår per kund.
      const thisYear: Map<string, number>[] = [new Map(), new Map()];
      const lastYear: Map<string, { sales: number; active: boolean }>[] = [new Map(), new Map()];
      for (const r of fyReports) {
        const meta = seasonById.get(r.seasonId);
        if (!meta) continue;
        const slot = meta.type === "VAR" ? 0 : 1;
        for (const v of r.visits) {
          const sale = toNumber(v.sales);
          if (meta.year === fyYear) {
            thisYear[slot].set(v.customerId, (thisYear[slot].get(v.customerId) ?? 0) + sale);
          } else {
            const prev = lastYear[slot].get(v.customerId);
            lastYear[slot].set(v.customerId, { sales: (prev?.sales ?? 0) + sale, active: v.customer.active });
          }
        }
      }

      const now = new Date();
      const seasons: ForecastSeason[] = slots.map((sl, i) => {
        const rec = thisYearRec[i];
        let status: SeasonStatus;
        if (rec) {
          const start = isoWeekMonday(fyYear, rec.weekStart);
          const end = isoWeekMonday(fyYear, rec.weekEnd);
          end.setUTCDate(end.getUTCDate() + 6); // söndagen i sista veckan
          status = now < start ? "future" : now > end ? "past" : "current";
        } else {
          status = "future"; // säsongen ej upplagd → har inte börjat
        }

        const actual = [...thisYear[i].values()].reduce((a, b) => a + b, 0);
        // Prognosdel: fjolår för ej besökta, fortfarande aktiva kunder.
        let forecast = 0;
        if (status !== "past") {
          for (const [custId, ly] of lastYear[i]) {
            if (ly.active && !thisYear[i].has(custId)) forecast += ly.sales;
          }
        }

        const hasBasis = actual > 0 || forecast > 0;
        const prevLabel = `${sl.label} ${fyYear - 1}`;
        let note: string;
        if (status === "past") {
          note = "avslutad · utfall";
        } else if (status === "current") {
          note = totalCustomers > 0 ? `pågår · ${thisYear[i].size} av ${totalCustomers} kunder besökta` : "pågår";
        } else {
          note = hasBasis ? `ej börjat · prognos på ${prevLabel}` : "ej börjat · underlag saknas";
        }

        return { label: `${sl.label} ${fyYear}`, status, note, actual, forecast, total: actual + forecast, hasBasis };
      });

      const actualTotal = seasons.reduce((a, s) => a + s.actual, 0);
      const forecastTotal = seasons.reduce((a, s) => a + s.forecast, 0);
      const total = actualTotal + forecastTotal;
      // Fjolårets faktiska helår (alla kunder, båda säsonger) för tillväxt-%.
      const prevYearTotal = lastYear.reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y.sales, 0), 0);

      // Visa bara med underlag: fjolårsdata att prognostisera mot, eller ett helt
      // avslutat år (då prognosen = utfallet).
      const allPast = seasons.every(s => s.status === "past");
      if (total > 0 && (prevYearTotal > 0 || allPast)) {
        forecastData = { year: fyYear, total, actualTotal, forecastTotal, prevYearTotal, seasons };
      }
    }
  }

  // Bryt ned analysen per kundtyp …
  const typeBreakdown: BreakdownItem[] = stats.byType.map(t => ({
    key: t.type,
    label: customerTypeLabels[t.type] ?? t.type,
    color: customerTypeChartColors[t.type] ?? "#64748b",
    sales: t.sales,
    // Avgiftssummorna stannar på servern för FT — se ReportRow ovan.
    ...(isAdmin && { ftFee: t.ftFee, mfFee: t.mfFee }),
    customers: t.customers,
    besok: t.besok,
    fashionShows: t.fashionShows,
    hangerShows: t.hangerShows,
    weekly: t.weekly,
  }));

  // … eller per distrikt (admin-översikt). Färg sätts av skalan i komponenten.
  const districtBreakdown: BreakdownItem[] = stats.byDistrict.map(d => ({
    key: d.id,
    label: d.label,
    color: THEME_ACCENT[theme],
    sales: d.sales,
    // Byggs bara för admin, men samma villkor här så mönstret är enhetligt.
    ...(isAdmin && { ftFee: d.ftFee, mfFee: d.mfFee }),
    customers: d.customers,
    besok: d.besok,
    fashionShows: d.fashionShows,
    hangerShows: d.hangerShows,
    weekly: d.weekly,
  }));

  const breakdown = showDistrictBreakdown ? districtBreakdown : typeBreakdown;
  const breakdownTitle = showDistrictBreakdown ? "Försäljning per distrikt" : "Försäljning per kundtyp";
  const filterNoun = showDistrictBreakdown ? "distrikt" : "kundtyp";
  const colorMode = showDistrictBreakdown ? "scale" : "category";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Översikt</h1>
          <p className="text-slate-500 text-sm mt-1">
            Säsong: {seasonLabel}
            {isAdmin && selectedDistrictId && allDistricts.length > 0 && (
              <span className="ml-2 text-blue-600">
                · {allDistricts.find(d => d.id === selectedDistrictId)?.name ?? ""}
              </span>
            )}
            {isAdmin && !selectedDistrictId && (
              <span className="ml-1 text-slate-400 text-xs">(alla distrikt)</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isAdmin && allDistricts.length > 0 && (
            <DistrictSwitcher
              districts={allDistricts}
              currentId={selectedDistrictId}
              seasonId={periodValue}
            />
          )}
          {allSeasons.length > 1 && (
            <SeasonSwitcher
              seasons={allSeasons.map(s => ({ id: s.id, type: s.type, year: s.year }))}
              currentValue={periodValue}
              districtId={selectedDistrictId}
            />
          )}
        </div>
      </div>

      {showGoals && selectedDistrictId && period && period.kind === "season" && (
        <GoalTracker
          districtId={selectedDistrictId}
          seasonId={period.id}
          seasonLabel={seasonLabel}
          initialGoal={seasonGoal ? {
            salesTarget: seasonGoal.salesTarget,
            visitsTarget: seasonGoal.visitsTarget,
            avgPerVisitTarget: seasonGoal.avgPerVisitTarget,
            fashionShowsTarget: seasonGoal.fashionShowsTarget,
          } : null}
          actuals={goalActuals}
          canEdit
        />
      )}

      {showGoalOverview && goalOverview.length > 0 && (
        <GoalOverview rows={goalOverview} seasonLabel={seasonLabel} />
      )}

      {period?.kind === "helar" && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 mb-6">
          Mål och uppföljning visas per säsong, inte för helår — växla till Vår eller Höst för att se dem.
        </div>
      )}

      {!isAdmin && selectedDistrictId && <ReportNudge districtId={selectedDistrictId} />}

      {forecastData && <ForecastCard data={forecastData} />}

      {stats.weeks.length > 0 && (
        <>
          <SalesAnalytics
            weeks={stats.weeks}
            breakdown={breakdown}
            breakdownTitle={breakdownTitle}
            filterNoun={filterNoun}
            colorMode={colorMode}
            showMf={isAdmin}
            hideGoalMetrics={showGoals && !!seasonGoal}
            currentLabel={seasonLabel}
            prevSeason={prevSeason}
            theme={theme}
          />
          {stats.showType.length > 0 && (
            <div className="mt-6">
              <ShowTypeAnalytics items={stats.showType} />
            </div>
          )}
          {stats.reports.length > 0 && (
            <div className="mt-6">
              <WeeklyReportList
                reports={stats.reports}
                showEditLink={!isAdmin}
                showDistrict={showDistrictBreakdown}
                showMf={isAdmin}
              />
            </div>
          )}
        </>
      )}

      {stats.weeks.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">Ingen data rapporterad ännu denna säsong.</p>
          {/* Bara för FT — admin har ingen egen rapportering att länka till,
              och en tom aggregerad vy över flera distrikt har ingen given
              "första kund" att peka på. */}
          {!isAdmin && (
            <Link href="/rapportera" className="inline-block mt-2 text-blue-600 hover:text-blue-700 font-medium">
              Börja rapportera →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

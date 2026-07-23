import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeLabels, customerTypeChartColors } from "@/lib/customerTypes";
import WeeklyReportList from "./WeeklyReportList";
import ReportNudge from "./ReportNudge";
import GoalTracker from "./GoalTracker";
import GoalOverview from "./GoalOverview";
import SalesAnalytics, { type BreakdownItem } from "./SalesAnalytics";
import ShowTypeAnalytics, { type ShowTypeItem } from "./ShowTypeAnalytics";
import SeasonSwitcher from "./SeasonSwitcher";
import DistrictSwitcher from "./DistrictSwitcher";

// Aggregat per kundtyp (server-sidan), mappas sedan till BreakdownItem
interface TypeAgg {
  type: string;
  sales: number; ftFee: number; mfFee: number;
  customers: number; besok: number; fashionShows: number; hangerShows: number;
  weekly: number[];
}

// Aggregat per distrikt (admin-översikt över alla distrikt)
interface DistAgg {
  id: string;
  label: string;
  sales: number; ftFee: number; mfFee: number;
  customers: number; besok: number; fashionShows: number; hangerShows: number;
  weekly: number[];
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; district?: string }>;
}) {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const { season: seasonParam, district: districtParam } = await searchParams;

  const allSeasons = await prisma.season.findMany({
    orderBy: [{ year: "desc" }, { type: "desc" }],
  });

  const currentSeason = seasonParam
    ? allSeasons.find(s => s.id === seasonParam) ?? allSeasons[0]
    : allSeasons[0];

  // Admin kan filtrera per distrikt
  const allDistricts = isAdmin
    ? await prisma.district.findMany({ orderBy: { number: "asc" }, select: { id: true, number: true, name: true } })
    : [];
  const selectedDistrictId = isAdmin
    ? (districtParam ?? null)
    : (session?.user.districtId ?? null);

  type ReportRow = {
    id: string; week: number; status: string;
    districtNumber: number; districtName: string;
    totalSales: number; totalToPay: number; totalCustomers: number;
    visits: { id: string; customerName: string; customerType: string; numberOfCustomers: number; sales: number; isFashionShow: boolean; isHangerShow: boolean; ftFee: number; mfFee: number; totalToPay: number; comment: string | null }[];
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

  if (currentSeason) {
    const where = {
      seasonId: currentSeason.id,
      ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}),
    };

    const reports = await prisma.weeklyReport.findMany({
      where,
      include: {
        district: { select: { number: true, name: true } },
        visits: { include: { customer: { select: { name: true, type: true } } } },
      },
      orderBy: { week: "asc" },
    });

    // Unika veckor — flera distrikt kan rapportera samma vecka (en rapport per
    // distrikt × vecka); utan dedup dubbleras x-axeln och staplarna splittras
    stats.weeks = [...new Set(reports.map(r => r.week))].sort((a, b) => a - b);
    stats.reports = reports.map(r => ({
      id: r.id,
      week: r.week,
      status: r.status,
      districtNumber: r.district.number,
      districtName: r.district.name,
      totalSales: r.visits.reduce((s, v) => s + v.sales + v.fashionShowSales, 0),
      totalToPay: r.visits.reduce((s, v) => s + v.totalToPay, 0),
      totalCustomers: r.visits.reduce((s, v) => s + v.numberOfCustomers, 0),
      visits: r.visits.map(v => ({
        id: v.id,
        customerName: v.customer.name,
        customerType: v.customer.type,
        numberOfCustomers: v.numberOfCustomers,
        sales: v.sales + v.fashionShowSales,
        isFashionShow: v.isFashionShow,
        isHangerShow: v.isHangerShow,
        ftFee: v.ftFee,
        mfFee: v.mfFee,
        totalToPay: v.totalToPay,
        comment: v.comment,
      })),
    }));

    // Per kundtyp: aggregat + försäljning per vecka (för korsfiltrering)
    const weeksOrder = stats.weeks;
    const weekIdx = new Map(weeksOrder.map((w, i) => [w, i]));
    const typeKeys = ["TRAFFPUNKT", "FORENING", "VARDHEM", "BOENDE_55", "STOD_HALSOSAMVERKAN", "OVRIGT"];
    const aggMap: Record<string, TypeAgg> = {};
    // Visningstyp-nedbrytning per kundtyp (Modevisning/Galge/Övriga). Modevisning
    // och Galge är ömsesidigt uteslutande (spärr i formulär + server), så
    // kategorierna summerar exakt till totalen utan dubbelräkning.
    type ShowSplit = { modevisning: { sales: number; besok: number }; galge: { sales: number; besok: number }; ovriga: { sales: number; besok: number } };
    const showMap: Record<string, ShowSplit> = {};
    for (const k of typeKeys) {
      aggMap[k] = { type: k, sales: 0, ftFee: 0, mfFee: 0, customers: 0, besok: 0, fashionShows: 0, hangerShows: 0, weekly: new Array(weeksOrder.length).fill(0) };
      showMap[k] = { modevisning: { sales: 0, besok: 0 }, galge: { sales: 0, besok: 0 }, ovriga: { sales: 0, besok: 0 } };
    }
    for (const r of reports) {
      const wi = weekIdx.get(r.week);
      for (const v of r.visits) {
        const a = aggMap[v.customer.type] ?? aggMap.OVRIGT;
        const sale = v.sales + v.fashionShowSales;
        a.sales += sale;
        a.ftFee += v.ftFee;
        a.mfFee += v.mfFee;
        a.customers += v.numberOfCustomers;
        a.besok += 1;
        if (v.isFashionShow) a.fashionShows += 1;
        if (v.isHangerShow) a.hangerShows += 1;
        if (wi !== undefined) a.weekly[wi] += sale;

        // Modevisning = hela besöket; annars galge; annars övriga.
        const cat = v.isFashionShow ? "modevisning" : v.isHangerShow ? "galge" : "ovriga";
        const s = (showMap[v.customer.type] ?? showMap.OVRIGT)[cat];
        s.sales += sale;
        s.besok += 1;
      }
    }
    stats.byType = typeKeys.map(k => aggMap[k]).filter(a => a.besok > 0);
    stats.showType = typeKeys
      .map(k => ({
        key: k,
        label: customerTypeLabels[k] ?? k,
        color: customerTypeChartColors[k] ?? "#64748b",
        categories: showMap[k],
      }))
      .filter(i => i.categories.modevisning.besok + i.categories.galge.besok + i.categories.ovriga.besok > 0);

    // Per distrikt (endast för admin-översikt över alla distrikt)
    if (showDistrictBreakdown) {
      const distMap: Record<string, DistAgg> = {};
      for (const r of reports) {
        let a = distMap[r.districtId];
        if (!a) {
          a = distMap[r.districtId] = {
            id: r.districtId,
            label: `D${r.district.number} – ${r.district.name}`,
            sales: 0, ftFee: 0, mfFee: 0, customers: 0, besok: 0, fashionShows: 0, hangerShows: 0,
            weekly: new Array(weeksOrder.length).fill(0),
          };
        }
        const wi = weekIdx.get(r.week);
        for (const v of r.visits) {
          const sale = v.sales + v.fashionShowSales;
          a.sales += sale;
          a.ftFee += v.ftFee;
          a.mfFee += v.mfFee;
          a.customers += v.numberOfCustomers;
          a.besok += 1;
          if (v.isFashionShow) a.fashionShows += 1;
        if (v.isHangerShow) a.hangerShows += 1;
          if (wi !== undefined) a.weekly[wi] += sale;
        }
      }
      stats.byDistrict = Object.values(distMap).sort((x, y) => x.label.localeCompare(y.label, "sv"));
    }
  }

  const seasonLabel = currentSeason
    ? `${currentSeason.type === "VAR" ? "Vår" : "Höst"} ${currentSeason.year}`
    : "–";

  // Mål och uppföljning per FT (valt distrikt × säsong). Visas för FT alltid,
  // för admin bara när ett specifikt distrikt är valt (mål sätts per FT).
  const showGoals = !!(selectedDistrictId && currentSeason);
  const seasonGoal = showGoals
    ? await prisma.seasonGoal.findUnique({
        where: { districtId_seasonId: { districtId: selectedDistrictId!, seasonId: currentSeason!.id } },
      })
    : null;
  const actualSales = stats.byType.reduce((s, t) => s + t.sales, 0);
  const actualVisits = stats.byType.reduce((s, t) => s + t.besok, 0);
  const goalActuals = {
    sales: actualSales,
    visits: actualVisits,
    avgPerVisit: actualVisits > 0 ? actualSales / actualVisits : 0,
    fashionShows: stats.byType.reduce((s, t) => s + t.fashionShows, 0),
  };

  // Samlad mål-översikt för admin i alla-distrikt-vyn: alla FT:ers mål vs utfall.
  const showGoalOverview = isAdmin && !selectedDistrictId && !!currentSeason;
  let goalOverview: {
    districtId: string;
    label: string;
    number: number;
    goal: { salesTarget: number; visitsTarget: number; avgPerVisitTarget: number; fashionShowsTarget: number };
    actual: { sales: number; visits: number; avgPerVisit: number; fashionShows: number };
  }[] = [];
  if (showGoalOverview) {
    const goals = await prisma.seasonGoal.findMany({
      where: { seasonId: currentSeason!.id },
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

  // År-mot-år: motsvarande fjolårssäsong (samma typ, året innan) för samma urval.
  const prevSeasonRec = currentSeason
    ? allSeasons.find(s => s.type === currentSeason.type && s.year === currentSeason.year - 1)
    : undefined;
  let prevSeason: { label: string; weekly: { week: number; sales: number }[] } | null = null;
  if (prevSeasonRec) {
    const prevReports = await prisma.weeklyReport.findMany({
      where: { seasonId: prevSeasonRec.id, ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}) },
      include: { visits: { select: { sales: true, fashionShowSales: true } } },
    });
    if (prevReports.length > 0) {
      const byWeek = new Map<number, number>();
      for (const r of prevReports) {
        const s = r.visits.reduce((acc, v) => acc + v.sales + v.fashionShowSales, 0);
        byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + s);
      }
      prevSeason = {
        label: `${prevSeasonRec.type === "VAR" ? "Vår" : "Höst"} ${prevSeasonRec.year}`,
        weekly: [...byWeek.entries()].map(([week, sales]) => ({ week, sales })).sort((a, b) => a.week - b.week),
      };
    }
  }

  // Bryt ned analysen per kundtyp …
  const typeBreakdown: BreakdownItem[] = stats.byType.map(t => ({
    key: t.type,
    label: customerTypeLabels[t.type] ?? t.type,
    color: customerTypeChartColors[t.type] ?? "#64748b",
    sales: t.sales,
    ftFee: t.ftFee,
    mfFee: t.mfFee,
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
    color: "#1d4ed8",
    sales: d.sales,
    ftFee: d.ftFee,
    mfFee: d.mfFee,
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
              seasonId={currentSeason?.id ?? ""}
            />
          )}
          {allSeasons.length > 1 && (
            <SeasonSwitcher
              seasons={allSeasons.map(s => ({
                id: s.id,
                label: `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}`,
              }))}
              currentId={currentSeason?.id ?? ""}
              districtId={selectedDistrictId}
            />
          )}
        </div>
      </div>

      {showGoals && selectedDistrictId && currentSeason && (
        <GoalTracker
          districtId={selectedDistrictId}
          seasonId={currentSeason.id}
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

      {!isAdmin && selectedDistrictId && <ReportNudge districtId={selectedDistrictId} />}

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
                seasonId={currentSeason?.id ?? ""}
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
        </div>
      )}
    </div>
  );
}

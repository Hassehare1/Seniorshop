import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeLabels, customerTypeChartColors } from "@/lib/customerTypes";
import WeeklyReportList from "./WeeklyReportList";
import ReportNudge from "./ReportNudge";
import SalesAnalytics, { type BreakdownItem } from "./SalesAnalytics";
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
    const typeKeys = ["TRAFFPUNKT", "FORENING", "VARDHEM", "BOENDE_55", "OVRIGT"];
    const aggMap: Record<string, TypeAgg> = {};
    for (const k of typeKeys) {
      aggMap[k] = { type: k, sales: 0, ftFee: 0, mfFee: 0, customers: 0, besok: 0, fashionShows: 0, hangerShows: 0, weekly: new Array(weeksOrder.length).fill(0) };
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
      }
    }
    stats.byType = typeKeys.map(k => aggMap[k]).filter(a => a.besok > 0);

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
          />
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

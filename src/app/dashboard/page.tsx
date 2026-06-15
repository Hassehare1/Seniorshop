import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WeeklyReportList from "./WeeklyReportList";
import SalesAnalytics, { type TypeAgg } from "./SalesAnalytics";
import SeasonSwitcher from "./SeasonSwitcher";
import DistrictSwitcher from "./DistrictSwitcher";

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
    totalSales: number; totalToPay: number; totalCustomers: number;
    visits: { id: string; customerName: string; customerType: string; numberOfCustomers: number; sales: number; isFashionShow: boolean; ftFee: number; mfFee: number; totalToPay: number; comment: string | null }[];
  };

  let stats = {
    totalSales: 0, totalFtFee: 0, totalMfFee: 0, totalVisits: 0, totalCustomers: 0,
    besokCount: 0, fashionShows: 0,
    weeklyData: [] as { week: number; sales: number; accumulated: number }[],
    byType: [] as TypeAgg[],
    reports: [] as ReportRow[],
  };

  if (currentSeason) {
    const where = {
      seasonId: currentSeason.id,
      ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}),
    };

    const reports = await prisma.weeklyReport.findMany({
      where,
      include: { visits: { include: { customer: { select: { name: true, type: true } } } } },
      orderBy: { week: "asc" },
    });

    let accumulated = 0;
    stats.weeklyData = reports.map(r => {
      const weeklySales = r.visits.reduce((s, v) => s + v.sales + v.fashionShowSales, 0);
      accumulated += weeklySales;
      return { week: r.week, sales: weeklySales, accumulated };
    });

    const allVisits = reports.flatMap(r => r.visits);
    stats.totalSales = allVisits.reduce((s, v) => s + v.sales + v.fashionShowSales, 0);
    stats.totalFtFee = allVisits.reduce((s, v) => s + v.ftFee, 0);
    stats.totalMfFee = allVisits.reduce((s, v) => s + v.mfFee, 0);
    stats.totalVisits = reports.length;
    stats.totalCustomers = allVisits.reduce((s, v) => s + v.numberOfCustomers, 0);
    stats.besokCount = allVisits.length;
    stats.fashionShows = allVisits.filter(v => v.isFashionShow).length;
    stats.reports = reports.map(r => ({
      id: r.id,
      week: r.week,
      status: r.status,
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
        ftFee: v.ftFee,
        mfFee: v.mfFee,
        totalToPay: v.totalToPay,
        comment: v.comment,
      })),
    }));

    // Per kundtyp: aggregat + försäljning per vecka (för korsfiltrering)
    const weeksOrder = stats.weeklyData.map(d => d.week);
    const weekIdx = new Map(weeksOrder.map((w, i) => [w, i]));
    const typeKeys = ["TRAFFPUNKT", "FORENING", "VARDHEM", "BOENDE_55", "OVRIGT"];
    const aggMap: Record<string, TypeAgg> = {};
    for (const k of typeKeys) {
      aggMap[k] = { type: k, sales: 0, ftFee: 0, mfFee: 0, customers: 0, besok: 0, fashionShows: 0, weekly: new Array(weeksOrder.length).fill(0) };
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
        if (wi !== undefined) a.weekly[wi] += sale;
      }
    }
    stats.byType = typeKeys.map(k => aggMap[k]).filter(a => a.besok > 0);
  }

  const seasonLabel = currentSeason
    ? `${currentSeason.type === "VAR" ? "Vår" : "Höst"} ${currentSeason.year}`
    : "–";

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

      {stats.weeklyData.length > 0 && (
        <>
          <SalesAnalytics weeks={stats.weeklyData.map(d => d.week)} types={stats.byType} />
          {stats.reports.length > 0 && (
            <div className="mt-6">
              <WeeklyReportList
                reports={stats.reports}
                seasonId={currentSeason?.id ?? ""}
                showEditLink={!isAdmin}
              />
            </div>
          )}
        </>
      )}

      {stats.weeklyData.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">Ingen data rapporterad ännu denna säsong.</p>
        </div>
      )}
    </div>
  );
}

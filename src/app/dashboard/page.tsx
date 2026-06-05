import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatSEK } from "@/lib/fees";
import SeasonChart from "@/components/charts/SeasonChart";

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  const currentSeason = await prisma.season.findFirst({
    orderBy: [{ year: "desc" }, { type: "desc" }],
  });

  let stats = {
    totalSales: 0,
    totalFtFee: 0,
    totalMfFee: 0,
    totalVisits: 0,
    totalCustomers: 0,
    weeklyData: [] as { week: number; sales: number; accumulated: number }[],
  };

  if (currentSeason) {
    const where = isAdmin
      ? { seasonId: currentSeason.id }
      : {
          seasonId: currentSeason.id,
          districtId: session?.user.districtId ?? undefined,
        };

    const reports = await prisma.weeklyReport.findMany({
      where,
      include: { visits: true },
      orderBy: { week: "asc" },
    });

    let accumulated = 0;
    stats.weeklyData = reports.map((r) => {
      const weeklySales = r.visits.reduce((s, v) => s + v.sales, 0);
      accumulated += weeklySales;
      return { week: r.week, sales: weeklySales, accumulated };
    });

    const allVisits = reports.flatMap((r) => r.visits);
    stats.totalSales = allVisits.reduce((s, v) => s + v.sales, 0);
    stats.totalFtFee = allVisits.reduce((s, v) => s + v.ftFee, 0);
    stats.totalMfFee = allVisits.reduce((s, v) => s + v.mfFee, 0);
    stats.totalVisits = allVisits.length;
    stats.totalCustomers = allVisits.reduce(
      (s, v) => s + v.numberOfCustomers,
      0
    );
  }

  const seasonLabel = currentSeason
    ? `${currentSeason.type === "VAR" ? "Vår" : "Höst"} ${currentSeason.year}`
    : "–";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Översikt</h1>
        <p className="text-slate-500 text-sm mt-1">Säsong: {seasonLabel}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total försäljning"
          value={formatSEK(stats.totalSales)}
          sub="ink. moms"
        />
        <StatCard
          label="FT-avgift"
          value={formatSEK(stats.totalFtFee)}
          sub="ex. moms"
        />
        <StatCard
          label="MF-avgift"
          value={formatSEK(stats.totalMfFee)}
          sub="ex. moms"
        />
        <StatCard
          label="Antal besök"
          value={stats.totalVisits.toString()}
          sub={`${stats.totalCustomers} kunder`}
        />
      </div>

      {stats.weeklyData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Ackumulerad försäljning per vecka
          </h2>
          <SeasonChart data={stats.weeklyData} />
        </div>
      )}

      {stats.weeklyData.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">Ingen data rapporterad ännu denna säsong.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCurrentWeekAndYear } from "@/lib/week";
import { resolveReportSeason } from "@/lib/season";
import ReportForm from "./ReportForm";

export default async function RapporteraPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; season?: string }>;
}) {
  const session = await auth();
  if (!session?.user.districtId) redirect("/dashboard");

  const { week: weekParam, season: seasonParam } = await searchParams;

  const [customers, seasons, feeConfig] = await Promise.all([
    prisma.customer.findMany({
      where: { districtId: session.user.districtId, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.season.findMany({ orderBy: [{ year: "desc" }, { type: "desc" }] }),
    prisma.feeConfig.findUnique({
      where: { districtId: session.user.districtId },
    }),
  ]);

  // Säsongen att skriva till. Ingen fallback till senaste säsongen — se
  // resolveReportSeason för varför.
  const { week: currentWeekNum, year: currentYear } = getCurrentWeekAndYear();
  const initialSeason = resolveReportSeason(seasons, currentWeekNum, currentYear, seasonParam);

  if (!initialSeason) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Rapportera vecka</h1>
          <p className="text-slate-500 text-sm mt-1">Distrikt {session.user.districtNumber}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="text-2xl mb-2">📅</p>
          <p className="font-semibold text-amber-800">Ingen aktiv säsong</p>
          <p className="text-amber-700 text-sm mt-1">
            Vecka {currentWeekNum} {currentYear} ligger inte i någon säsong. Kontakta admin så att
            säsongen läggs in — då kan du rapportera som vanligt.
          </p>
        </div>
      </div>
    );
  }

  const initialWeek = weekParam ? parseInt(weekParam, 10) : undefined;

  // Varning om vald säsong är framtida
  const isFutureSeason =
    initialSeason.year > currentYear ||
    (initialSeason.year === currentYear && initialSeason.weekStart > currentWeekNum);

  const existingReports = await prisma.weeklyReport.findMany({
    where: {
      districtId: session.user.districtId,
      seasonId: initialSeason.id,
    },
    select: { id: true, week: true, status: true },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Rapportera vecka</h1>
        <p className="text-slate-500 text-sm mt-1">
          Distrikt {session.user.districtNumber}
        </p>
      </div>
      {isFutureSeason && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          📅 Nästa säsong börjar vecka {initialSeason.weekStart} — du rapporterar i förväg.
        </div>
      )}
      <ReportForm
        customers={customers}
        seasons={seasons}
        currentSeason={initialSeason}
        existingReports={existingReports}
        districtId={session.user.districtId}
        initialWeek={initialWeek}
        initialSeasonId={initialSeason.id}
        feeConfig={
          feeConfig
            ? {
                ftFeePercent: feeConfig.ftFeePercent,
                mfFeePercent: feeConfig.mfFeePercent,
                // Decimal kan inte serialiseras till en klientkomponent —
                // skickas som exakt sträng och läses in i Decimal igen.
                mfFeeCap: feeConfig.mfFeeCap.toFixed(2),
                vatMultiplier: feeConfig.vatMultiplier,
              }
            : {
                ftFeePercent: 0.075,
                mfFeePercent: 0.01,
                mfFeeCap: "6000.00",
                vatMultiplier: 1.25,
              }
        }
      />
    </div>
  );
}

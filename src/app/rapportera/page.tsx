import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCurrentWeekAndYear } from "@/lib/week";
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

  // Aktiv säsong = den vars veckointervall + år matchar dagens datum
  const { week: currentWeekNum, year: currentYear } = getCurrentWeekAndYear();
  const currentSeason =
    seasons.find(
      s => s.year === currentYear && s.weekStart <= currentWeekNum && s.weekEnd >= currentWeekNum
    ) ?? seasons[0] ?? null;

  if (!currentSeason) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Rapportera vecka</h1>
          <p className="text-slate-500 text-sm mt-1">Distrikt {session.user.districtNumber}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <p className="text-2xl mb-2">📅</p>
          <p className="font-semibold text-amber-800">Ingen aktiv säsong</p>
          <p className="text-amber-700 text-sm mt-1">Kontakta admin för att skapa en säsong innan du kan rapportera.</p>
        </div>
      </div>
    );
  }

  // Om URL innehåller ?season=... använd den säsongen (t.ex. länk från dashboard)
  const initialSeason = seasonParam
    ? seasons.find(s => s.id === seasonParam) ?? currentSeason
    : currentSeason;

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
          feeConfig ?? {
            ftFeePercent: 0.075,
            mfFeePercent: 0.01,
            mfFeeCap: 6000,
            vatMultiplier: 1.25,
          }
        }
      />
    </div>
  );
}

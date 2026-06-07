import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ReportForm from "./ReportForm";

function getCurrentWeekAndYear() {
  const d = new Date();
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

export default async function RapporteraPage() {
  const session = await auth();
  if (!session?.user.districtId) redirect("/dashboard");

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
  // Fallback till senaste om man befinner sig mellan säsonger
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

  // Varning om valt säsong-fallback är framtida (admin skapade nästa säsong i förväg)
  const isFutureSeason =
    currentSeason.year > currentYear ||
    (currentSeason.year === currentYear && currentSeason.weekStart > currentWeekNum);

  const existingReports = await prisma.weeklyReport.findMany({
    where: {
      districtId: session.user.districtId,
      seasonId: currentSeason.id,
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
          📅 Nästa säsong börjar vecka {currentSeason.weekStart} — du rapporterar i förväg.
        </div>
      )}
      <ReportForm
        customers={customers}
        seasons={seasons}
        currentSeason={currentSeason}
        existingReports={existingReports}
        districtId={session.user.districtId}
        feeConfig={
          feeConfig ?? {
            ftFeePercent: 0.075,
            mfFeePercent: 0.01,
            mfFeeCap: 5999.812,
            vatMultiplier: 1.25,
          }
        }
      />
    </div>
  );
}

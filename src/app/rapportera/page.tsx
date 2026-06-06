import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ReportForm from "./ReportForm";

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

  const currentSeason = seasons[0] ?? null;

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

  const existingReports = currentSeason
    ? await prisma.weeklyReport.findMany({
        where: {
          districtId: session.user.districtId,
          seasonId: currentSeason.id,
        },
        select: { id: true, week: true, status: true },
      })
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Rapportera vecka</h1>
        <p className="text-slate-500 text-sm mt-1">
          Distrikt {session.user.districtNumber}
        </p>
      </div>
      <ReportForm
        customers={customers}
        seasons={seasons}
        currentSeason={currentSeason ?? null}
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

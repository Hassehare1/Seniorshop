import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import KunderClient, { type VisitMap } from "./KunderClient";

export default async function KunderPage() {
  const session = await auth();
  if (!session?.user.districtId) redirect("/dashboard");
  const districtId = session.user.districtId;

  const [customers, reports, seasons] = await Promise.all([
    prisma.customer.findMany({
      where: { districtId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.weeklyReport.findMany({
      where: { districtId },
      select: { seasonId: true, week: true, visits: { select: { customerId: true } } },
    }),
    prisma.season.findMany({ orderBy: [{ year: "desc" }, { type: "desc" }] }),
  ]);

  // Antal besök + senaste vecka per kund och säsong
  const visitMap: VisitMap = {};
  for (const r of reports) {
    for (const v of r.visits) {
      const byCustomer = visitMap[v.customerId] ?? (visitMap[v.customerId] = {});
      const info = byCustomer[r.seasonId] ?? (byCustomer[r.seasonId] = { count: 0, lastWeek: 0 });
      info.count++;
      if (r.week > info.lastWeek) info.lastWeek = r.week;
    }
  }

  const seasonsWithData = new Set(reports.map(r => r.seasonId));
  const seasonOptions = seasons
    .filter(s => seasonsWithData.has(s.id))
    .map(s => ({ id: s.id, label: `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}` }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mina kunder</h1>
          <p className="text-slate-500 text-sm mt-1">
            Distrikt {session.user.districtNumber} — {customers.filter(c => c.active).length} aktiva
          </p>
        </div>
      </div>
      <KunderClient
        customers={customers}
        districtId={districtId}
        seasons={seasonOptions}
        visitMap={visitMap}
        defaultSeasonId={seasonOptions[0]?.id ?? ""}
      />
    </div>
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminKunderClient, { type VisitMap } from "./AdminKunderClient";

export default async function AdminKunder() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [customers, reports, seasons] = await Promise.all([
    prisma.customer.findMany({
      // region behövs för att visa postnumret i rätt format per land
      include: { district: { select: { number: true, name: true, region: true } } },
      orderBy: [{ district: { number: "asc" } }, { name: "asc" }],
    }),
    prisma.weeklyReport.findMany({
      select: { seasonId: true, week: true, visits: { select: { customerId: true } } },
    }),
    prisma.season.findMany({ orderBy: [{ year: "desc" }, { type: "desc" }] }),
  ]);

  // Antal besök + senaste vecka per kund och säsong (alla distrikt)
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Alla kunder</h1>
        <p className="text-slate-500 text-sm mt-1">{customers.length} kunder totalt</p>
      </div>

      {/* Rutan som stod här beskrev ett utvecklingsbehov för en läsare som inte
          kunde göra något åt det: att FT saknade uppföljning av postnummer.
          Behovet är löst — "Mina kunder" har samma filter och samma
          täckningsrad — så anteckningen har inget kvar att säga. */}
      <AdminKunderClient
        customers={customers}
        seasons={seasonOptions}
        visitMap={visitMap}
        defaultSeasonId={seasonOptions[0]?.id ?? ""}
      />
    </div>
  );
}

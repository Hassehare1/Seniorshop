import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminKunderClient, { type VisitMap } from "./AdminKunderClient";

export default async function AdminKunder() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

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

      {/* Postnummer fylls i av varje FT på sina egna kunder. Uppföljningen
          finns tills vidare bara här, så FT ser inte hur långt hon kommit. */}
      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">Postnummer följs bara upp här</p>
        <p className="text-sm text-amber-800 mt-0.5">
          FT ser ingen markering över vilka av sina kunder som saknar postnummer — hon måste
          öppna kundkorten ett i taget för att veta. Vill du att hon ska kunna följa sitt eget
          arbete behöver samma markering läggas till på “Mina kunder”.
        </p>
      </div>
      <AdminKunderClient
        customers={customers}
        seasons={seasonOptions}
        visitMap={visitMap}
        defaultSeasonId={seasonOptions[0]?.id ?? ""}
      />
    </div>
  );
}

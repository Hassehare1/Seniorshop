import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getISOWeek } from "@/lib/week";
import AdminRapporterClient from "./AdminRapporterClient";
import { toNumber } from "@/lib/fees";

export default async function AdminRapporterPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { season: seasonParam } = await searchParams;

  const allSeasons = await prisma.season.findMany({
    orderBy: [{ year: "desc" }, { type: "desc" }],
  });

  if (!allSeasons.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Rapportstatus</h1>
        <p className="text-slate-500">Ingen säsong hittades.</p>
      </div>
    );
  }

  const currentSeason = seasonParam
    ? allSeasons.find(s => s.id === seasonParam) ?? allSeasons[0]
    : allSeasons[0];

  const districts = await prisma.district.findMany({
    include: {
      users: { select: { name: true, email: true } },
      reports: {
        where: { seasonId: currentSeason.id },
        select: { id: true, week: true, status: true, visits: { select: { totalToPay: true } } },
        orderBy: { week: "asc" },
      },
    },
    orderBy: { number: "asc" },
  });

  // totalToPay är Decimal i databasen — konvertera vid klientgränsen.
  const districtsForClient = districts.map(d => ({
    ...d,
    reports: d.reports.map(r => ({
      ...r,
      visits: r.visits.map(v => ({ totalToPay: toNumber(v.totalToPay) })),
    })),
  }));

  // Visa bara veckor inom säsongens intervall
  const weeks = Array.from(
    { length: currentSeason.weekEnd - currentSeason.weekStart + 1 },
    (_, i) => i + currentSeason.weekStart
  );

  const currentWeek = getISOWeek();

  return (
    <AdminRapporterClient
      // Klienten lägger districts i useState, som bara läser propen vid
      // montering. Säsongsbytet är en mjuk navigering (router.push), så utan
      // key behåller rutnätet förra säsongens rapporter medan rubrik och
      // veckokolumner byts — veckor med data såg ut att sakna rapport helt.
      // Samma lösning som ReportForm, se rapportera/page.tsx.
      key={currentSeason.id}
      districts={districtsForClient}
      weeks={weeks}
      currentWeek={currentWeek}
      seasonId={currentSeason.id}
      seasonLabel={`${currentSeason.type === "VAR" ? "Vår" : "Höst"} ${currentSeason.year}`}
      allSeasons={allSeasons.map(s => ({
        id: s.id,
        label: `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}`,
      }))}
    />
  );
}

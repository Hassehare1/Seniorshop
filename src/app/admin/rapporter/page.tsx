import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getISOWeek } from "@/lib/week";
import AdminRapporterClient from "./AdminRapporterClient";

export default async function AdminRapporterPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

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

  // Visa bara veckor inom säsongens intervall
  const weeks = Array.from(
    { length: currentSeason.weekEnd - currentSeason.weekStart + 1 },
    (_, i) => i + currentSeason.weekStart
  );

  const currentWeek = getISOWeek();

  return (
    <AdminRapporterClient
      districts={districts}
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

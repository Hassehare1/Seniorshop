import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminRapporterClient from "./AdminRapporterClient";

export default async function AdminRapporterPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const currentSeason = await prisma.season.findFirst({
    orderBy: [{ year: "desc" }, { type: "desc" }],
  });

  if (!currentSeason) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Rapportstatus</h1>
        <p className="text-slate-500">Ingen säsong hittades.</p>
      </div>
    );
  }

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

  const weeks = Array.from(
    { length: 52 },
    (_, i) => i + 1
  );

  const currentWeek = (() => {
    const d = new Date();
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  })();

  return (
    <AdminRapporterClient
      districts={districts}
      weeks={weeks}
      currentWeek={currentWeek}
      seasonId={currentSeason.id}
      seasonLabel={`${currentSeason.type === "VAR" ? "Vår" : "Höst"} ${currentSeason.year}`}
    />
  );
}

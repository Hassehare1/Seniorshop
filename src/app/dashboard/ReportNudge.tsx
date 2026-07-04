import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentWeekAndYear } from "@/lib/week";

// Tunn statusrad på FT:s översikt: är innevarande vecka rapporterad?
// "Rapporterad" = inlämnad (SUBMITTED/APPROVED). En sparad DRAFT visas som
// påbörjad ("N besök registrerade") — matchar spara-under-veckan-flödet.
// Utgår alltid från dagens datum, oberoende av vilken säsong som visas i vyn.
export default async function ReportNudge({ districtId }: { districtId: string }) {
  const { week, year } = getCurrentWeekAndYear();

  // Säsongen som pågår just nu — ingen puff mellan säsonger
  const season = await prisma.season.findFirst({
    where: { year, weekStart: { lte: week }, weekEnd: { gte: week } },
  });
  if (!season) return null;

  const report = await prisma.weeklyReport.findUnique({
    where: { districtId_seasonId_week: { districtId, seasonId: season.id, week } },
    select: { status: true, _count: { select: { visits: true } } },
  });

  // Inlämnad eller godkänd — diskret grön bekräftelse
  if (report && report.status !== "DRAFT") {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-lg px-3 py-1.5 mb-4 text-sm">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Vecka {week} är rapporterad</span>
      </div>
    );
  }

  const visitCount = report?._count.visits ?? 0;
  const started = visitCount > 0;

  return (
    <div className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-lg px-3 py-1.5 mb-4 text-sm">
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="flex-1 min-w-0">
        Vecka {week} ej rapporterad
        {started && ` · ${visitCount === 1 ? "1 besök registrerat" : `${visitCount} besök registrerade`}`}
      </span>
      <Link href="/rapportera" className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
        {started ? "Fortsätt →" : "Rapportera →"}
      </Link>
    </div>
  );
}

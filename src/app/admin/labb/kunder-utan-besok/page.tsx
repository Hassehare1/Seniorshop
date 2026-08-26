import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { customerTypeLabels, customerTypeColors } from "@/lib/customerTypes";
import Filters from "./Filters";

// Rangordning för "senast besökt" — Höst kommer efter Vår samma år, så
// jämförelsen blir en enkel sifferjämförelse i stället för att hantera typ
// och år separat överallt.
function seasonRank(type: "VAR" | "HOST", year: number): number {
  return year * 2 + (type === "HOST" ? 1 : 0);
}

export default async function KunderUtanBesokPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; district?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { season: seasonParam, district: districtParam } = await searchParams;

  const [allSeasons, allDistricts] = await Promise.all([
    prisma.season.findMany({ orderBy: [{ year: "desc" }, { type: "desc" }] }),
    prisma.district.findMany({ orderBy: { number: "asc" }, select: { id: true, number: true, name: true } }),
  ]);

  if (allSeasons.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Kunder utan besök</h1>
        <p className="text-slate-500">Ingen säsong hittades.</p>
      </div>
    );
  }

  const currentSeason = seasonParam ? allSeasons.find(s => s.id === seasonParam) ?? allSeasons[0] : allSeasons[0];
  const selectedDistrictId = districtParam || null;
  const seasonLabel = `${currentSeason.type === "VAR" ? "Vår" : "Höst"} ${currentSeason.year}`;

  const customers = await prisma.customer.findMany({
    where: { active: true, ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}) },
    select: {
      id: true, name: true, type: true, customerNumber: true,
      district: { select: { number: true, name: true } },
    },
    orderBy: [{ district: { number: "asc" } }, { name: "asc" }],
  });

  const visitedThisSeason = await prisma.visit.findMany({
    where: {
      report: { seasonId: currentSeason.id },
      customer: { active: true, ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}) },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  const visitedIds = new Set(visitedThisSeason.map(v => v.customerId));

  const missing = customers.filter(c => !visitedIds.has(c.id));

  // Senaste besök före den valda säsongen, oavsett hur långt tillbaka — bara
  // för de kunder som faktiskt saknar besök, så frågan hålls liten.
  const missingIds = missing.map(c => c.id);
  const pastVisits = missingIds.length
    ? await prisma.visit.findMany({
        where: { customerId: { in: missingIds } },
        select: { customerId: true, report: { select: { season: { select: { type: true, year: true } } } } },
      })
    : [];

  const lastSeasonByCustomer = new Map<string, { type: "VAR" | "HOST"; year: number }>();
  for (const v of pastVisits) {
    const s = v.report.season;
    const prev = lastSeasonByCustomer.get(v.customerId);
    if (!prev || seasonRank(s.type, s.year) > seasonRank(prev.type, prev.year)) {
      lastSeasonByCustomer.set(v.customerId, s);
    }
  }

  const rows = missing
    .map(c => {
      const last = lastSeasonByCustomer.get(c.id) ?? null;
      return {
        ...c,
        lastSeasonLabel: last ? `${last.type === "VAR" ? "Vår" : "Höst"} ${last.year}` : null,
        sortRank: last ? seasonRank(last.type, last.year) : -1, // "Aldrig besökt" hamnar först — mest angeläget
      };
    })
    .sort((a, b) => a.sortRank - b.sortRank || a.district.number - b.district.number || a.name.localeCompare(b.name, "sv"));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kunder utan besök</h1>
          <p className="text-slate-500 text-sm mt-1">
            {seasonLabel} · {missing.length} av {customers.length} kunder
            {selectedDistrictId && allDistricts.length > 0 && (
              <span className="ml-1 text-blue-600">
                · {allDistricts.find(d => d.id === selectedDistrictId)?.name ?? ""}
              </span>
            )}
          </p>
        </div>
        <Filters seasons={allSeasons.map(s => ({ id: s.id, label: `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}` }))} districts={allDistricts} currentSeasonId={currentSeason.id} currentDistrictId={selectedDistrictId} />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-6">
        🧪 Labb — under utveckling. Listan bygger på riktig data men syns bara för admin. Kan tas bort eller byggas
        vidare beroende på om den visar sig användbar.
      </div>

      {missing.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">Alla kunder har besökts denna säsong{selectedDistrictId ? " i det här distriktet" : ""}.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {!selectedDistrictId && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Distrikt</th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kund</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kundtyp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Senast besökt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  {!selectedDistrictId && (
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">D{c.district.number} – {c.district.name}</td>
                  )}
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${customerTypeColors[c.type] ?? "bg-slate-100 text-slate-600"}`}>
                      {customerTypeLabels[c.type] ?? c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.lastSeasonLabel ? (
                      <span className="text-slate-600">{c.lastSeasonLabel}</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Aldrig besökt</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

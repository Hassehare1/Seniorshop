"use client";

import { useRouter } from "next/navigation";

// Bara navigering — ingen data i klientens tillstånd. Ett useState med
// serverdatan som startvärde hade frusit tabellen i förra veckan vid byte
// (se stale-props-fällan i rapportstatusrutnätet).
export default function PeriodValjare({
  seasons,
  seasonId,
  weeks,
  week,
}: {
  seasons: { id: string; label: string }[];
  seasonId: string;
  weeks: number[];
  /** Veckonumret, eller "alla" för hela säsongen. */
  week: string;
}) {
  const router = useRouter();

  function gaTill(nästaSeason: string, nästaWeek: string) {
    router.push(`/admin/veckorapport?season=${nästaSeason}&week=${nästaWeek}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-500">
        Säsong
        <select
          value={seasonId}
          onChange={e => gaTill(e.target.value, "alla")}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 bg-white"
        >
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-500">
        Vecka
        <select
          value={week}
          onChange={e => gaTill(seasonId, e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 bg-white"
        >
          <option value="alla">Hela säsongen</option>
          {weeks.map(w => (
            <option key={w} value={String(w)}>v {w}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

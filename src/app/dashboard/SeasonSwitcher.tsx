"use client";

import { useRouter } from "next/navigation";
import type { SeasonRow } from "@/lib/season";

interface Props {
  seasons: SeasonRow[];
  currentValue: string; // säsongs-id, eller "helar:<år>"
  districtId?: string | null;
}

// Ett år-med-år, bara till för att bygga menyn nedan.
function groupByYear(seasons: SeasonRow[]) {
  const years = new Map<number, { var?: SeasonRow; host?: SeasonRow }>();
  for (const s of seasons) {
    const entry = years.get(s.year) ?? {};
    if (s.type === "VAR") entry.var = s; else entry.host = s;
    years.set(s.year, entry);
  }
  return [...years.entries()].sort((a, b) => b[0] - a[0]); // nyast år först
}

const COOKIE_NAME = "seniorshop_season";

export default function SeasonSwitcher({ seasons, currentValue, districtId }: Props) {
  const router = useRouter();

  function navigate(value: string) {
    // Kom ihåg valet till nästa besök — bara på den här enheten, ingen server inblandad.
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=31536000; SameSite=Lax`;
    const params = new URLSearchParams({ season: value });
    if (districtId) params.set("district", districtId);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Säsong:</span>
      <select
        aria-label="Säsong"
        value={currentValue}
        onChange={e => navigate(e.target.value)}
        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {groupByYear(seasons).map(([year, { var: v, host: h }]) => (
          <optgroup key={year} label={String(year)}>
            {v && h && <option value={`helar:${year}`}>Helår {year}</option>}
            {v && <option value={v.id}>Vår {year}</option>}
            {h && <option value={h.id}>Höst {year}</option>}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

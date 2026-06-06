"use client";

import { useRouter } from "next/navigation";

interface Props {
  seasons: { id: string; label: string }[];
  currentId: string;
  districtId?: string | null;
}

export default function SeasonSwitcher({ seasons, currentId, districtId }: Props) {
  const router = useRouter();

  function navigate(seasonId: string) {
    const params = new URLSearchParams({ season: seasonId });
    if (districtId) params.set("district", districtId);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Säsong:</span>
      <select
        value={currentId}
        onChange={e => navigate(e.target.value)}
        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {seasons.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

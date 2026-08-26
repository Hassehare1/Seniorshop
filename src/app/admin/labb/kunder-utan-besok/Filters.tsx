"use client";

import { useRouter } from "next/navigation";

interface Props {
  seasons: { id: string; label: string }[];
  districts: { id: string; number: number; name: string }[];
  currentSeasonId: string;
  currentDistrictId: string | null;
}

export default function Filters({ seasons, districts, currentSeasonId, currentDistrictId }: Props) {
  const router = useRouter();

  function navigate(seasonId: string, districtId: string | null) {
    const params = new URLSearchParams({ season: seasonId });
    if (districtId) params.set("district", districtId);
    router.push(`/admin/labb/kunder-utan-besok?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select
        aria-label="Distrikt"
        value={currentDistrictId ?? ""}
        onChange={e => navigate(currentSeasonId, e.target.value || null)}
        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Alla distrikt</option>
        {districts.map(d => (
          <option key={d.id} value={d.id}>D{d.number} – {d.name}</option>
        ))}
      </select>
      <select
        aria-label="Säsong"
        value={currentSeasonId}
        onChange={e => navigate(e.target.value, currentDistrictId)}
        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {seasons.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

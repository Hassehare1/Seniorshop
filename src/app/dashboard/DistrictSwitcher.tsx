"use client";

import { useRouter } from "next/navigation";

interface Props {
  districts: { id: string; number: number; name: string }[];
  currentId: string | null;
  seasonId: string;
}

export default function DistrictSwitcher({ districts, currentId, seasonId }: Props) {
  const router = useRouter();

  function navigate(districtId: string) {
    // Kom ihåg valet till nästa besök — bara på den här enheten, ingen server inblandad.
    // Tomt värde (Alla distrikt) sparas också, annars vore "Alla" omöjligt att komma ihåg.
    document.cookie = `seniorshop_district=${districtId}; path=/; max-age=31536000; SameSite=Lax`;
    const params = new URLSearchParams();
    if (seasonId) params.set("season", seasonId);
    if (districtId) params.set("district", districtId);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Distrikt:</span>
      <select
        aria-label="Distrikt"
        value={currentId ?? ""}
        onChange={e => navigate(e.target.value)}
        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Alla distrikt</option>
        {districts.map(d => (
          <option key={d.id} value={d.id}>D{d.number} – {d.name}</option>
        ))}
      </select>
    </div>
  );
}

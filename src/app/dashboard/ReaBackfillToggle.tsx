"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialEnabled: boolean;
}

// Tidsbegränsad brytare: öppnar REA-kolumnen i WeeklyReportList för
// redigering på redan godkända veckor. Stängs igen när admin är klar med
// efterhandsrättningen — se [[rea-besok]] i minnet.
export default function ReaBackfillToggle({ initialEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/rea-backfill", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
      setEnabled(next);
      router.refresh();
    } catch {
      setError("Kunde inte spara. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">
          REA-ändring i efterhand
          <span
            className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
              enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {enabled ? "Öppen" : "Stängd"}
          </span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {enabled
            ? "REA går att kryssa på besök i godkända veckor. Stäng när alla FT hunnit gå igenom sina veckor."
            : "Redan gjorda REA-märkningar ligger kvar. Öppna för att låta ändringar göras igen."}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="REA-ändring i efterhand"
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
          enabled ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : ""
          }`}
        />
      </button>
    </div>
  );
}

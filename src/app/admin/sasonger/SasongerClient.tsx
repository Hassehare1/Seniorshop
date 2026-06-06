"use client";

import { useState } from "react";

interface Season {
  id: string;
  type: string;
  year: number;
  weekStart: number;
  weekEnd: number;
  _count: { reports: number };
}

const currentYear = new Date().getFullYear();

const defaultWeeks = {
  VAR: { weekStart: 5, weekEnd: 26 },
  HOST: { weekStart: 27, weekEnd: 52 },
};

export default function SasongerClient({ seasons: initial }: { seasons: Season[] }) {
  const [seasons, setSeasons] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "VAR", year: currentYear, weekStart: 5, weekEnd: 26 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflictId, setConflictId] = useState<string | null>(null);

  function handleTypeChange(type: string) {
    setForm(f => ({ ...f, type, ...defaultWeeks[type as keyof typeof defaultWeeks] }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setConflictId(null);
    const res = await fetch("/api/admin/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setSeasons(prev => [{ ...created, _count: { reports: 0 } }, ...prev]);
      setShowForm(false);
      setForm({ type: "VAR", year: currentYear, weekStart: 5, weekEnd: 26 });
    } else if (res.status === 409) {
      const { existingId } = await res.json().catch(() => ({}));
      setConflictId(existingId ?? null);
      setError("Säsongen finns redan.");
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Något gick fel" }));
      setError(msg);
    }
    setSaving(false);
  }

  async function handleUpdateExisting() {
    if (!conflictId) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/seasons/${conflictId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: form.weekStart, weekEnd: form.weekEnd }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSeasons(prev => prev.map(s => s.id === conflictId ? updated : s));
      setShowForm(false);
      setConflictId(null);
      setForm({ type: "VAR", year: currentYear, weekStart: 5, weekEnd: 26 });
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Något gick fel" }));
      setError(msg);
    }
    setSaving(false);
  }

  // Den aktiva säsongen är den med högst år+typ (samma logik som servern)
  const activeSeason = seasons[0];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Ny säsong
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Skapa ny säsong</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Typ</label>
              <select
                value={form.type}
                onChange={e => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="VAR">Vår</option>
                <option value="HOST">Höst</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">År</label>
              <input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Startvecka</label>
              <input
                type="number"
                min={1}
                max={52}
                value={form.weekStart}
                onChange={e => setForm(f => ({ ...f, weekStart: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Slutvecka</label>
              <input
                type="number"
                min={1}
                max={52}
                value={form.weekEnd}
                onChange={e => setForm(f => ({ ...f, weekEnd: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {error && (
            <div className="mt-3">
              <p className="text-red-600 text-sm">{error}</p>
              {conflictId && (
                <div className="mt-2 p-4 bg-white border-2 border-amber-400 rounded-lg">
                  <p className="text-sm text-slate-700 font-medium mb-3">
                    Vill du justera veckorna för den befintliga säsongen till v.{form.weekStart}–{form.weekEnd}?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdateExisting}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold px-6 py-2 rounded-lg shadow"
                    >
                      ✓ Ja, justera
                    </button>
                    <button
                      onClick={() => { setConflictId(null); setError(""); }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium px-6 py-2 rounded-lg"
                    >
                      Nej, avbryt
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!conflictId && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                {saving ? "Sparar..." : "Skapa säsong"}
              </button>
              <button onClick={() => { setShowForm(false); setError(""); setConflictId(null); }} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
                Avbryt
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Säsong</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">År</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veckor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rapporter</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {seasons.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {s.type === "VAR" ? "Vår" : "Höst"}
                </td>
                <td className="px-4 py-3 text-slate-700">{s.year}</td>
                <td className="px-4 py-3 text-slate-600">v.{s.weekStart}–{s.weekEnd}</td>
                <td className="px-4 py-3 text-slate-600">{s._count.reports} st</td>
                <td className="px-4 py-3">
                  {s.id === activeSeason?.id ? (
                    <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      Aktiv
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">
                      Arkiverad
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {seasons.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Inga säsonger skapade.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      <p className="text-xs text-slate-400">Den senaste säsongen (högst år + Höst före Vår) är alltid aktiv.</p>
    </div>
  );
}

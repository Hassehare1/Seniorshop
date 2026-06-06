"use client";

import { useState } from "react";

interface FeeConfig {
  ftFeePercent: number;
  mfFeePercent: number;
  mfFeeCap: number;
  vatMultiplier: number;
}

interface District {
  id: string;
  number: number;
  name: string;
  region: string;
  feeConfig: FeeConfig | null;
  users: { id: string; name: string | null; email: string }[];
  _count: { customers: number; reports: number };
}

interface Props {
  districts: District[];
}

export default function DistriktClient({ districts: initial }: Props) {
  const [districts, setDistricts] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState<FeeConfig>({ ftFeePercent: 0.075, mfFeePercent: 0.01, mfFeeCap: 5999.812, vatMultiplier: 1.25 });
  const [saving, setSaving] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({ number: "", name: "", region: "SE" });
  const [newError, setNewError] = useState("");
  const [newSaving, setNewSaving] = useState(false);

  function startEdit(d: District) {
    setEditingId(d.id);
    setFeeForm(d.feeConfig ?? { ftFeePercent: 0.075, mfFeePercent: 0.01, mfFeeCap: 5999.812, vatMultiplier: 1.25 });
  }

  async function saveFee() {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch(`/api/admin/districts/${editingId}/fee-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feeForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setDistricts(prev => prev.map(d =>
        d.id === editingId ? { ...d, feeConfig: updated } : d
      ));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function saveNewDistrict() {
    if (!newForm.number || !newForm.name) return;
    setNewSaving(true);
    setNewError("");
    const res = await fetch("/api/admin/districts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    if (res.ok) {
      const created = await res.json();
      setDistricts(prev => [...prev, created].sort((a, b) => a.number - b.number));
      setNewForm({ number: "", name: "", region: "SE" });
      setShowNewForm(false);
    } else {
      const { error } = await res.json().catch(() => ({ error: "Något gick fel" }));
      setNewError(error);
    }
    setNewSaving(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Distrikt & avgifter</h1>
          <p className="text-slate-500 text-sm mt-1">{districts.length} distrikt</p>
        </div>
        <button
          onClick={() => { setShowNewForm(!showNewForm); setNewError(""); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nytt distrikt
        </button>
      </div>

      {showNewForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Skapa nytt distrikt</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Distriktsnummer *</label>
              <input
                type="number"
                value={newForm.number}
                onChange={e => setNewForm(f => ({ ...f, number: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. 7"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Namn *</label>
              <input
                type="text"
                value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. Blekinge"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Region</label>
              <select
                value={newForm.region}
                onChange={e => setNewForm(f => ({ ...f, region: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SE">Sverige</option>
                <option value="FI">Finland</option>
                <option value="DK">Danmark</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Standardavgifter sätts automatiskt (FT 7,5%, MF 1%). Justera efteråt vid behov.</p>
          {newError && <p className="text-red-600 text-sm mt-2">{newError}</p>}
          <div className="flex gap-2 mt-4">
            <button
              onClick={saveNewDistrict}
              disabled={newSaving || !newForm.number || !newForm.name}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {newSaving ? "Sparar..." : "Skapa distrikt"}
            </button>
            <button onClick={() => setShowNewForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Avbryt</button>
          </div>
        </div>
      )}

      {editingId && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-700 mb-4">
            Justera avgifter – {districts.find(d => d.id === editingId)?.name}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">FT-avgift (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={(feeForm.ftFeePercent * 100).toFixed(1)}
                onChange={e => setFeeForm(f => ({ ...f, ftFeePercent: Number(e.target.value) / 100 }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">MF-avgift (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={(feeForm.mfFeePercent * 100).toFixed(1)}
                onChange={e => setFeeForm(f => ({ ...f, mfFeePercent: Number(e.target.value) / 100 }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">MF-tak (SEK ex moms)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={feeForm.mfFeeCap.toFixed(2)}
                onChange={e => setFeeForm(f => ({ ...f, mfFeeCap: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Momssats (multiplikator)</label>
              <input
                type="number"
                step="0.05"
                min="1"
                value={feeForm.vatMultiplier.toFixed(2)}
                onChange={e => setFeeForm(f => ({ ...f, vatMultiplier: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={saveFee}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {saving ? "Sparar..." : "Spara avgifter"}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nr</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Region</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">FT-avgift</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">MF-avgift</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">MF-tak</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kunder</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Användare</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {districts.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{d.number}</td>
                <td className="px-4 py-3 text-slate-700">{d.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{d.region}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{d.feeConfig ? `${(d.feeConfig.ftFeePercent * 100).toFixed(1)}%` : "–"}</td>
                <td className="px-4 py-3 text-slate-600">{d.feeConfig ? `${(d.feeConfig.mfFeePercent * 100).toFixed(1)}%` : "–"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {d.feeConfig
                    ? new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(d.feeConfig.mfFeeCap) + " kr"
                    : "–"}
                </td>
                <td className="px-4 py-3 text-slate-600">{d._count.customers}</td>
                <td className="px-4 py-3 text-slate-600">{d.users.map(u => u.name ?? u.email).join(", ") || "–"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(d)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Justera avgifter
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

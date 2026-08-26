"use client";

import { useState, useId } from "react";
import { STANDARD_FEE_CONFIG, formatSEK } from "@/lib/fees";

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
  const uid = useId();
  const [districts, setDistricts] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState<FeeConfig>({ ...STANDARD_FEE_CONFIG });
  const [saving, setSaving] = useState(false);
  // Namnredigering är fristående från avgiftsformuläret — ett enda fält,
  // direkt i tabellraden, i stället för ett eget formulärpanel.
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameForm, setNameForm] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({ number: "", name: "", region: "SE" });
  const [newError, setNewError] = useState("");
  const [newSaving, setNewSaving] = useState(false);

  function startEdit(d: District) {
    setEditingId(d.id);
    setFeeForm(d.feeConfig ?? { ...STANDARD_FEE_CONFIG });
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

  function startEditName(d: District) {
    setEditingNameId(d.id);
    setNameForm(d.name);
    setNameError("");
  }

  async function saveName() {
    if (!editingNameId) return;
    const trimmed = nameForm.trim();
    if (!trimmed) { setNameError("Namn krävs."); return; }
    setNameSaving(true);
    setNameError("");
    const res = await fetch(`/api/admin/districts/${editingNameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDistricts(prev => prev.map(d => (d.id === editingNameId ? { ...d, name: updated.name } : d)));
      setEditingNameId(null);
    } else {
      const { error } = await res.json().catch(() => ({ error: "Kunde inte spara namnet." }));
      setNameError(error);
    }
    setNameSaving(false);
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
        <form onSubmit={e => { e.preventDefault(); saveNewDistrict(); }} className="mb-6 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Skapa nytt distrikt</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-distriktsnummer`}>Distriktsnummer *</label>
              <input id={`${uid}-distriktsnummer`}
                type="number"
                value={newForm.number}
                onChange={e => setNewForm(f => ({ ...f, number: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. 7"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-namn`}>Namn *</label>
              <input id={`${uid}-namn`}
                type="text"
                value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. Blekinge"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-region`}>Region</label>
              <select id={`${uid}-region`}
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
              type="submit"
              disabled={newSaving || !newForm.number || !newForm.name}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {newSaving ? "Sparar..." : "Skapa distrikt"}
            </button>
            <button type="button" onClick={() => setShowNewForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">Avbryt</button>
          </div>
        </form>
      )}

      {editingId && (
        <form onSubmit={e => { e.preventDefault(); saveFee(); }} className="mb-6 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-700 mb-4">
            Justera avgifter – {districts.find(d => d.id === editingId)?.name}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-ft-avgift`}>FT-avgift (%)</label>
              <input id={`${uid}-ft-avgift`}
                type="number"
                step="0.1"
                min="0"
                value={(feeForm.ftFeePercent * 100).toFixed(1)}
                onChange={e => setFeeForm(f => ({ ...f, ftFeePercent: Number(e.target.value) / 100 }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-mf-avgift`}>MF-avgift (%)</label>
              <input id={`${uid}-mf-avgift`}
                type="number"
                step="0.1"
                min="0"
                value={(feeForm.mfFeePercent * 100).toFixed(1)}
                onChange={e => setFeeForm(f => ({ ...f, mfFeePercent: Number(e.target.value) / 100 }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-mf-tak-kr-ink-moms`}>MF-tak (kr ink moms)</label>
              <input id={`${uid}-mf-tak-kr-ink-moms`}
                type="number"
                step="1"
                min="0"
                value={Math.round(feeForm.mfFeeCap)}
                onChange={e => setFeeForm(f => ({ ...f, mfFeeCap: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-momssats`}>Momssats (%)</label>
              <input id={`${uid}-momssats`}
                type="number"
                step="1"
                min="0"
                max="100"
                value={Math.round((feeForm.vatMultiplier - 1) * 100)}
                onChange={e => setFeeForm(f => ({ ...f, vatMultiplier: 1 + Number(e.target.value) / 100 }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {saving ? "Sparar..." : "Spara avgifter"}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nr</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Region</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">FT-avgift</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">MF-avgift</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">MF-tak (ink moms)</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kunder</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Användare</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {districts.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{d.number}</td>
                <td className="px-4 py-3 text-slate-700">
                  {editingNameId === d.id ? (
                    <form
                      onSubmit={e => { e.preventDefault(); saveName(); }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={nameForm}
                        onChange={e => setNameForm(e.target.value)}
                        autoFocus
                        className="w-36 px-2 py-1 border border-blue-400 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={nameSaving}
                        title="Spara"
                        aria-label="Spara"
                        className="text-green-600 hover:text-green-800 disabled:text-slate-300 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNameId(null)}
                        title="Avbryt"
                        aria-label="Avbryt"
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {nameError && <span className="text-xs text-red-600">{nameError}</span>}
                    </form>
                  ) : (
                    <button
                      onClick={() => startEditName(d)}
                      title="Ändra namn"
                      className="hover:text-blue-700 hover:underline decoration-dotted underline-offset-2 text-left"
                    >
                      {d.name}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{d.region}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{d.feeConfig ? `${(d.feeConfig.ftFeePercent * 100).toFixed(1)}%` : "–"}</td>
                <td className="px-4 py-3 text-slate-600">{d.feeConfig ? `${(d.feeConfig.mfFeePercent * 100).toFixed(1)}%` : "–"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {d.feeConfig ? formatSEK(d.feeConfig.mfFeeCap) : "–"}
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
    </div>
  );
}

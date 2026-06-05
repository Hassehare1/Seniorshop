"use client";

import { useState } from "react";
import type { Customer } from "@prisma/client";

const customerTypes = [
  { value: "TRAFFPUNKT", label: "Träffpunkt" },
  { value: "FORENING", label: "Förening" },
  { value: "VARDHEM", label: "Vårdhem" },
  { value: "BOENDE_55", label: "Boende +55" },
  { value: "OVRIGT", label: "Övrigt" },
];

interface Props {
  customers: Customer[];
  districtId: string;
  typeLabels: Record<string, string>;
}

export default function KunderClient({ customers: initial, districtId, typeLabels }: Props) {
  const [customers, setCustomers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "TRAFFPUNKT", contactPerson: "", phone: "", address: "", notes: "",
  });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    typeLabels[c.type]?.toLowerCase().includes(filter.toLowerCase())
  );

  async function handleSave() {
    if (!form.name || !form.type) return;
    setSaving(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, districtId }),
    });
    if (res.ok) {
      const created = await res.json();
      setCustomers(prev => [created, ...prev]);
      setForm({ name: "", type: "TRAFFPUNKT", contactPerson: "", phone: "", address: "", notes: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  const typeColors: Record<string, string> = {
    TRAFFPUNKT: "bg-blue-100 text-blue-700",
    FORENING: "bg-green-100 text-green-700",
    VARDHEM: "bg-purple-100 text-purple-700",
    BOENDE_55: "bg-orange-100 text-orange-700",
    OVRIGT: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Sök kund eller typ..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Ny kund
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Lägg till kund</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Namn *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. Träffpunkt Centrum"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Typ *</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {customerTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Kontaktperson</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Förnamn Efternamn"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="070-000 00 00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Adress</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Gatuadress, Ort"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Kommentar</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Noteringar, öppettider, m.m."
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {saving ? "Sparar..." : "Spara kund"}
            </button>
            <button
              onClick={() => setShowForm(false)}
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Typ</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kommentar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className={`hover:bg-slate-50 ${!c.active ? "opacity-40" : ""}`}>
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[c.type] ?? "bg-slate-100 text-slate-600"}`}>
                    {typeLabels[c.type] ?? c.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.contactPerson ?? "–"}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone ?? "–"}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{c.notes ?? "–"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Inga kunder hittades.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

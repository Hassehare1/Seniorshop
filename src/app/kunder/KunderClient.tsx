"use client";

import { useState } from "react";
import Link from "next/link";
import { customerTypeLabels, customerTypeColors, customerTypeOptions } from "@/lib/customerTypes";
import type { Customer } from "@prisma/client";
import ImportKunder from "./ImportKunder";

const emptyForm = {
  name: "", type: "TRAFFPUNKT", contactPerson: "", contactRole: "", email: "",
  phone: "", address: "", size: "", notes: "", active: true,
};

interface Props {
  customers: Customer[];
  districtId: string;
}

export default function KunderClient({ customers: initial, districtId }: Props) {
  const [customers, setCustomers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    customerTypeLabels[c.type]?.toLowerCase().includes(filter.toLowerCase())
  );

  function startEdit(c: Customer) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      type: c.type,
      contactPerson: c.contactPerson ?? "",
      contactRole: c.contactRole ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: c.address ?? "",
      size: c.size != null ? String(c.size) : "",
      notes: c.notes ?? "",
      active: c.active,
    });
    setShowForm(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name || !form.type) return;
    setSaving(true);
    setSaveError("");

    if (editingId) {
      const res = await fetch(`/api/customers/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setCustomers(prev => prev.map(c => c.id === editingId ? updated : c));
        setEditingId(null);
        setForm(emptyForm);
      } else {
        const { error } = await res.json().catch(() => ({ error: "Något gick fel vid sparning." }));
        setSaveError(error ?? "Något gick fel vid sparning.");
      }
    } else {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, districtId }),
      });
      if (res.ok) {
        const created = await res.json();
        setCustomers(prev => [created, ...prev]);
        setForm(emptyForm);
        setShowForm(false);
      } else {
        const { error } = await res.json().catch(() => ({ error: "Något gick fel vid sparning." }));
        setSaveError(error ?? "Något gick fel vid sparning.");
      }
    }

    setSaving(false);
  }

  const formOpen = showForm || editingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Sök kund eller typ..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => { setShowImport(s => !s); setShowForm(false); setEditingId(null); }}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg"
        >
          Importera
        </button>
        <button
          onClick={() => { setShowForm(!showForm); setShowImport(false); setEditingId(null); setForm(emptyForm); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Ny kund
        </button>
      </div>

      {showImport && (
        <ImportKunder onImported={created => setCustomers(prev => [...created, ...prev])} />
      )}

      {formOpen && (
        <form
          onSubmit={e => { e.preventDefault(); handleSave(); }}
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <h3 className="font-semibold text-slate-700 mb-4">
            {editingId ? "Redigera kund" : "Lägg till kund"}
          </h3>
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
                {customerTypeOptions.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Storlek (antal boende/medlemmar)</label>
              <input
                type="number"
                min={0}
                value={form.size}
                onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. 40"
              />
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Kontaktroll</label>
              <input
                type="text"
                value={form.contactRole}
                onChange={e => setForm(f => ({ ...f, contactRole: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. Aktivitetsansvarig"
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
              <label className="block text-xs font-medium text-slate-600 mb-1">E-post</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="namn@exempel.se"
              />
            </div>
            <div className="col-span-2">
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
            {editingId && (
              <div className="col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                    className={`relative w-10 h-6 rounded-full transition-colors ${form.active ? "bg-green-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? "left-5" : "left-1"}`} />
                  </div>
                  <span className="text-sm text-slate-700">
                    {form.active ? "Aktiv kund" : "Inaktiv (visas ej i rapportformuläret)"}
                  </span>
                </label>
              </div>
            )}
          </div>
          {saveError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
          )}
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving || !form.name}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {saving ? "Sparar..." : editingId ? "Spara ändringar" : "Spara kund"}
            </button>
            <button
              type="button"
              onClick={editingId ? cancelEdit : () => { setShowForm(false); setSaveError(""); }}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Typ</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kommentar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className={`hover:bg-slate-50 ${!c.active ? "opacity-40" : ""}`}>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/kunder/${c.id}`} className="text-slate-800 hover:text-blue-700 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${customerTypeColors[c.type] ?? "bg-slate-100 text-slate-600"}`}>
                    {customerTypeLabels[c.type] ?? c.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.contactPerson ?? "–"}
                  {c.contactRole && <span className="text-slate-400"> · {c.contactRole}</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.phone ?? "–"}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{c.notes ?? "–"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(c)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Redigera
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Inga kunder hittades.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

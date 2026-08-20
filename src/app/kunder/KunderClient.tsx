"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { customerTypeLabels, customerTypeColors, customerTypeOptions } from "@/lib/customerTypes";
import { formatPostalCode, postalCodeDigits, validatePostalCode } from "@/lib/postalCode";
import {
  materialFilterOptions, materialSummary, matchesMaterialFilter,
  type MaterialFilter,
} from "@/lib/salesMaterial";
import type { Customer } from "@prisma/client";
import ImportKunder from "./ImportKunder";

const emptyForm = {
  name: "", type: "TRAFFPUNKTER", contactPerson: "", contactRole: "", email: "",
  phone: "", address: "", postalCode: "", city: "", notes: "", active: true,
  postersA3: "", postersA4: "", digitalMaterial: false, digitalMaterialNote: "",
};

export type VisitMap = Record<string, Record<string, { count: number; lastWeek: number }>>;

interface Props {
  customers: Customer[];
  districtId: string;
  districtNumber: number;
  seasons: { id: string; label: string }[];
  visitMap: VisitMap;
  defaultSeasonId: string;
  region: string; // distriktets region — styr postnumrets längd
}

export default function KunderClient({ customers: initial, districtId, districtNumber, seasons, visitMap, defaultSeasonId, region }: Props) {
  const uid = useId();
  const [customers, setCustomers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [season, setSeason] = useState(defaultSeasonId);
  const [visitFilter, setVisitFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>("all");
  const [exporting, setExporting] = useState(false);

  const visitCount = (id: string) => visitMap[id]?.[season]?.count ?? 0;
  const lastWeek = (id: string) => visitMap[id]?.[season]?.lastWeek ?? 0;
  const besokBadge = (n: number) =>
    n >= 2
      ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">{n} besök</span>
      : n === 1
        ? <span className="text-slate-500 text-xs">1 besök</span>
        : <span className="text-slate-300 text-xs">—</span>;

  const filtered = customers.filter(c => {
    const q = filter.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(q) || (customerTypeLabels[c.type]?.toLowerCase().includes(q) ?? false);
    const n = visitCount(c.id);
    const matchVisit =
      visitFilter === "all" ||
      (visitFilter === "none" && n === 0) ||
      (visitFilter === "one" && n === 1) ||
      (visitFilter === "multi" && n >= 2);
    const matchMaterial = matchesMaterialFilter(c, materialFilter);
    return matchSearch && matchVisit && matchMaterial;
  });

  const seasonStats = season
    ? customers.reduce(
        (a, c) => {
          const n = visitCount(c.id);
          if (n >= 2) a.multi++;
          else if (n === 0) a.none++;
          return a;
        },
        { multi: 0, none: 0 }
      )
    : null;

  async function exportXlsx() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const label = seasons.find(s => s.id === season)?.label ?? "";
      // Hela registret följer med, inte bara namn och typ — exporten ska duga
      // som säkerhetskopia och gå att läsa in i vilket verktyg som helst.
      const rows = filtered.map(c => ({
        Kundnr: `D${districtNumber}-${c.customerNumber}`,
        Namn: c.name,
        Typ: customerTypeLabels[c.type] ?? c.type,
        Kontaktperson: c.contactPerson ?? "",
        Kontaktroll: c.contactRole ?? "",
        Telefon: c.phone ?? "",
        "E-post": c.email ?? "",
        Adress: c.address ?? "",
        Postnummer: formatPostalCode(c.postalCode, region),
        Postort: c.city ?? "",
        Kommentar: c.notes ?? "",
        "Affischer A3": c.postersA3 || "",
        "Affischer A4": c.postersA4 || "",
        Digitalt: c.digitalMaterial ? (c.digitalMaterialNote?.trim() || "Ja") : "",
        [`Besök ${label}`]: visitCount(c.id),
        "Senaste vecka": lastWeek(c.id) || "",
        Status: c.active ? "Aktiv" : "Inaktiv",
        Granskning: c.approved ? "Godkänd" : "Väntar granskning",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = Object.keys(rows[0] ?? {}).map(h => ({
        wch: h === "Namn" || h === "Adress" || h === "Kommentar" || h === "E-post" ? 26 : 15,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kunder");
      XLSX.writeFile(wb, `Kunder_besok_${label.replace(/\s+/g, "_") || "lista"}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

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
      postalCode: c.postalCode ?? "",
      city: c.city ?? "",
      notes: c.notes ?? "",
      postersA3: c.postersA3 ? String(c.postersA3) : "",
      postersA4: c.postersA4 ? String(c.postersA4) : "",
      digitalMaterial: c.digitalMaterial,
      digitalMaterialNote: c.digitalMaterialNote ?? "",
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

    // Fånga fel format innan anropet — samma regel gäller på servern.
    const postalCodeError = validatePostalCode(form.postalCode, region);
    if (postalCodeError) {
      setSaveError(postalCodeError);
      return;
    }

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
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Sök kund eller typ..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {seasons.length > 0 && (
          <>
            <select value={season} onChange={e => setSeason(e.target.value)} aria-label="Säsong" className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {seasons.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={visitFilter} onChange={e => setVisitFilter(e.target.value)} aria-label="Filtrera på besök" className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="all">Alla besök</option>
              <option value="none">Ej besökta</option>
              <option value="one">1 besök</option>
              <option value="multi">Återbesök (≥2)</option>
            </select>
            <select
              value={materialFilter}
              onChange={e => setMaterialFilter(e.target.value as MaterialFilter)}
              aria-label="Filtrera säljmaterial"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {materialFilterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={exportXlsx} disabled={exporting} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg">
              {exporting ? "Exporterar…" : "Excel"}
            </button>
          </>
        )}
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

      {seasonStats && (
        <p className="text-xs text-slate-500 -mt-1">
          {seasons.find(s => s.id === season)?.label}: {customers.length} kunder · <span className="text-blue-600 font-medium">{seasonStats.multi} med återbesök</span> · {seasonStats.none} ej besökta
        </p>
      )}

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
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-namn`}>Namn *</label>
              <input id={`${uid}-namn`}
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. Träffpunkt Centrum"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-typ`}>Typ *</label>
              <select id={`${uid}-typ`}
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
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-kontaktperson`}>Kontaktperson</label>
              <input id={`${uid}-kontaktperson`}
                type="text"
                value={form.contactPerson}
                onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Förnamn Efternamn"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-kontaktroll`}>Kontaktroll</label>
              <input id={`${uid}-kontaktroll`}
                type="text"
                value={form.contactRole}
                onChange={e => setForm(f => ({ ...f, contactRole: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. Aktivitetsansvarig"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-telefon`}>Telefon</label>
              <input id={`${uid}-telefon`}
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="070-000 00 00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-e-post`}>E-post</label>
              <input id={`${uid}-e-post`}
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="namn@exempel.se"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-adress`}>Adress</label>
              <input id={`${uid}-adress`}
                type="text"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Gatuadress, Ort"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-postnummer`}>Postnummer</label>
              <input id={`${uid}-postnummer`}
                type="text"
                inputMode="numeric"
                value={form.postalCode}
                onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={postalCodeDigits(region) === 4 ? "1234" : "123 45"}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-postort`}>Postort</label>
              <input id={`${uid}-postort`}
                type="text"
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="t.ex. Gärsnäs"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-kommentar`}>Kommentar</label>
              <textarea id={`${uid}-kommentar`}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Noteringar, öppettider, m.m."
              />
            </div>
            {/* Säljmaterial — antal styr, noll betyder att formatet inte skickas */}
            <div className="col-span-2 border-t border-slate-200 pt-4 mt-1">
              <p className="text-xs font-semibold text-slate-600 mb-2">Säljmaterial</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-a3`}>Affischer A3</label>
                  <input id={`${uid}-a3`} type="number" min={0} inputMode="numeric"
                    value={form.postersA3}
                    onChange={e => setForm(f => ({ ...f, postersA3: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-a4`}>Affischer A4</label>
                  <input id={`${uid}-a4`} type="number" min={0} inputMode="numeric"
                    value={form.postersA4}
                    onChange={e => setForm(f => ({ ...f, postersA4: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 mt-3 cursor-pointer w-fit">
                <input type="checkbox" checked={form.digitalMaterial}
                  onChange={e => setForm(f => ({ ...f, digitalMaterial: e.target.checked }))} className="rounded" />
                Digitalt material
              </label>
              {form.digitalMaterial && (
                <input type="text" value={form.digitalMaterialNote}
                  onChange={e => setForm(f => ({ ...f, digitalMaterialNote: e.target.value }))}
                  className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Vad skickas digitalt? T.ex. PDF prislista"
                />
              )}
            </div>
            {editingId && (
              <div className="col-span-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className="flex items-center gap-3 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
                >
                  <span
                    aria-hidden="true"
                    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${form.active ? "bg-green-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? "left-5" : "left-1"}`} />
                  </span>
                  <span className="text-sm text-slate-700">
                    {form.active ? "Aktiv kund" : "Inaktiv (visas ej i rapportformuläret)"}
                  </span>
                </button>
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
              {seasons.length > 0 && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Besök</th>}
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Material</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kommentar</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className={`hover:bg-slate-50 ${!c.active ? "opacity-40" : ""} ${seasons.length > 0 && visitCount(c.id) >= 2 ? "bg-blue-50" : ""}`}>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/kunder/${c.id}`} className="text-slate-800 hover:text-blue-700 hover:underline">
                    {c.name}
                  </Link>
                  {!c.approved && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 align-middle">
                      Väntar granskning
                    </span>
                  )}
                  <span className="block text-[11px] text-slate-400 font-normal">D{districtNumber}-{c.customerNumber}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${customerTypeColors[c.type] ?? "bg-slate-100 text-slate-600"}`}>
                    {customerTypeLabels[c.type] ?? c.type}
                  </span>
                </td>
                {seasons.length > 0 && <td className="px-4 py-3">{besokBadge(visitCount(c.id))}</td>}
                <td className="px-4 py-3 text-slate-600">
                  {c.contactPerson ?? "–"}
                  {c.contactRole && <span className="text-slate-400"> · {c.contactRole}</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.phone ?? "–"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {materialSummary(c)
                    ? <span className="text-slate-600">{materialSummary(c)}</span>
                    : <span className="text-amber-600" title="Inget säljmaterial inlagt">saknas</span>}
                </td>
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
                <td colSpan={seasons.length > 0 ? 7 : 6} className="px-4 py-8 text-center text-slate-400">Inga kunder hittades.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

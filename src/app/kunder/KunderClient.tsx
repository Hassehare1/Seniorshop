"use client";

import { useState } from "react";
import Link from "next/link";
import { customerTypeLabels, customerTypeColors } from "@/lib/customerTypes";
import { formatPostalCode, validatePostalCode } from "@/lib/postalCode";
import {
  materialFilterOptions, materialSummary, matchesMaterialFilter,
  type MaterialFilter,
} from "@/lib/salesMaterial";
import { validateVenue } from "@/lib/venue";
import type { Customer } from "@prisma/client";
import ImportKunder from "./ImportKunder";
import CustomerForm, { emptyCustomerForm as emptyForm } from "./CustomerForm";

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
  const [customers, setCustomers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
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

  const hasActiveFilter = filter !== "" || visitFilter !== "all" || materialFilter !== "all";
  function resetFilters() {
    setFilter("");
    setVisitFilter("all");
    setMaterialFilter("all");
  }

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
        Möteslokal: c.venue ?? "",
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

  async function handleSave() {
    if (!form.name || !form.type) return;

    const venueError = validateVenue(form.venue);
    if (venueError) {
      setSaveError(venueError);
      return;
    }

    // Fånga fel format innan anropet — samma regel gäller på servern.
    const postalCodeError = validatePostalCode(form.postalCode, region);
    if (postalCodeError) {
      setSaveError(postalCodeError);
      return;
    }

    setSaving(true);
    setSaveError("");

    // Formuläret skapar bara NYA kunder. Ändringar görs på kundkortet, dit
    // både namnet och Redigera leder.
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

    setSaving(false);
  }

  const formOpen = showForm;

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
          onClick={() => { setShowImport(s => !s); setShowForm(false); }}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg"
        >
          Importera
        </button>
        <button
          onClick={() => { setShowForm(!showForm); setShowImport(false); setForm(emptyForm); }}
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
        <CustomerForm
          form={form}
          setForm={setForm}
          region={region}
          saving={saving}
          saveError={saveError}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setSaveError(""); }}
        />
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
                  {/* prefetch av: /kunder/[id] är dynamisk och saknar loading.tsx, så varje
                      synlig rad hade annars kostat en full serverrendering med
                      Prisma-fråga — och nu finns TVÅ länkar per rad. */}
                  <Link href={`/kunder/${c.id}`} prefetch={false} className="text-slate-800 hover:text-blue-700 hover:underline">
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
                  {/* Går till kundkortet, samma ställe som ett klick på namnet.
                      Tidigare öppnades ett formulär HÖGST UPP i listan — står
                      man långt ned syns ingenting hända, och man tror att
                      knappen är trasig. Ett ställe att ändra en kund på. */}
                  <Link
                    href={`/kunder/${encodeURIComponent(c.id)}`}
                    prefetch={false}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Redigera
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={seasons.length > 0 ? 7 : 6} className="px-4 py-8 text-center text-slate-400">
                  {customers.length === 0 ? (
                    <>
                      Inga kunder registrerade i ditt distrikt än.{" "}
                      <button
                        onClick={() => { setShowForm(true); setShowImport(false); setForm(emptyForm); }}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Lägg till din första kund →
                      </button>
                    </>
                  ) : hasActiveFilter ? (
                    <>
                      Inga kunder matchar sökningen.{" "}
                      <button onClick={resetFilters} className="text-blue-600 hover:text-blue-700 font-medium">
                        Rensa filter
                      </button>
                    </>
                  ) : (
                    "Inga kunder hittades."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

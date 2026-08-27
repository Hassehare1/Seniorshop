"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  customerTypeLabels as typeLabels,
  customerTypeColors as typeColors,
} from "@/lib/customerTypes";
import { formatPostalCode } from "@/lib/postalCode";
import {
  materialFilterOptions, materialSummary, matchesMaterialFilter,
  type MaterialFilter,
} from "@/lib/salesMaterial";
import TypeEditDialog from "./TypeEditDialog";
import MergeDialog, { type MergeState } from "./MergeDialog";

export interface Customer {
  id: string;
  name: string;
  customerNumber: number;
  type: string;
  contactPerson: string | null;
  contactRole: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  notes: string | null;
  venue: string | null;
  postersA3: number;
  postersA4: number;
  digitalMaterial: boolean;
  digitalMaterialNote: string | null;
  active: boolean;
  approved: boolean;
  district: { number: number; name: string; region: string };
}

export type VisitMap = Record<string, Record<string, { count: number; lastWeek: number }>>;

interface Props {
  customers: Customer[];
  seasons: { id: string; label: string }[];
  visitMap: VisitMap;
  defaultSeasonId: string;
}

export default function AdminKunderClient({ customers: initial, seasons, visitMap, defaultSeasonId }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initial);
  // Sammanslagning av dubbletter: markera exakt två, välj vilken som behålls.
  // Uppstår vid inläsning när samma kund stavas olika i två filer.
  const [selected, setSelected] = useState<string[]>([]);
  const [merge, setMerge] = useState<MergeState | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("active");
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [season, setSeason] = useState(defaultSeasonId);
  // Kundtypsbyte sker via en dialog, inte direkt i tabellen — konsekvensen är
  // retroaktiv och behöver förklaras innan den sker.
  const [typeEdit, setTypeEdit] = useState<{ customer: Customer; valdTyp: string } | null>(null);
  const [visitFilter, setVisitFilter] = useState("all");
  const [postalFilter, setPostalFilter] = useState("ALL");
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

  const pendingCount = customers.filter(c => !c.approved).length;

  function toggleSelect(id: string) {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  /** Hämtar granskningen. Anropas när dialogen öppnas och när man byter vilken kund som behålls. */
  async function loadMergePreview(keepId: string, removeId: string) {
    setMerge({ keepId, removeId, preview: null, busy: true, error: "" });
    const res = await fetch("/api/admin/customers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepId, removeId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMerge({ keepId, removeId, preview: null, busy: false, error: data.error ?? "Kunde inte hämta granskningen." });
      return;
    }
    setMerge({ keepId, removeId, preview: data.summary, busy: false, error: "" });
  }

  async function confirmMerge() {
    if (!merge?.preview) return;
    const { keepId, removeId } = merge;
    const removedName = merge.preview.remove.name;
    const keptName = merge.preview.keep.name;
    setMerge(m => (m ? { ...m, busy: true, error: "" } : m));
    const res = await fetch("/api/admin/customers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepId, removeId, confirm: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMerge(m => (m ? { ...m, busy: false, error: data.error ?? "Sammanslagningen misslyckades." } : m));
      return;
    }
    // Den raderade kunden bort ur listan direkt; besöksräkningen för den
    // behållna kommer från servern, så sidan hämtas om.
    setCustomers(prev => prev.filter(c => c.id !== removeId));
    setSelected([]);
    setMerge(null);
    setMessage(
      `✓ ${removedName} slogs ihop med ${keptName}` +
        (data.result?.visitsMoved ? ` · ${data.result.visitsMoved} besök flyttades` : " · inga besök att flytta")
    );
    router.refresh();
  }

  const filtered = customers.filter(c => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.district.name.toLowerCase().includes(search.toLowerCase()) ||
      String(c.district.number).includes(search);
    const matchType = typeFilter === "ALL" || c.type === typeFilter;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "active" && c.active) ||
      (statusFilter === "inactive" && !c.active);
    const matchReview =
      reviewFilter === "ALL" ||
      (reviewFilter === "pending" && !c.approved) ||
      (reviewFilter === "approved" && c.approved);
    const n = visitCount(c.id);
    const matchVisit =
      visitFilter === "all" ||
      (visitFilter === "none" && n === 0) ||
      (visitFilter === "one" && n === 1) ||
      (visitFilter === "multi" && n >= 2);
    const matchPostal =
      postalFilter === "ALL" ||
      (postalFilter === "missing" && !c.postalCode) ||
      (postalFilter === "has" && !!c.postalCode);
    const matchMaterial = matchesMaterialFilter(c, materialFilter);
    return matchSearch && matchType && matchStatus && matchReview && matchVisit && matchPostal && matchMaterial;
  });

  // "active" är standardläget för statusFilter, inte "ALL" — jämförs mot det,
  // annars ser standardvyn ut som ett aktivt filter.
  const hasActiveFilter =
    search !== "" || typeFilter !== "ALL" || statusFilter !== "active" ||
    reviewFilter !== "ALL" || visitFilter !== "all" || postalFilter !== "ALL" || materialFilter !== "all";
  function resetFilters() {
    setSearch("");
    setTypeFilter("ALL");
    setStatusFilter("active");
    setReviewFilter("ALL");
    setVisitFilter("all");
    setPostalFilter("ALL");
    setMaterialFilter("all");
  }

  // Räknas på det filtrerade urvalet, så att en sökning på t.ex. "D6" ger
  // täckningen för just det distriktet.
  const missingPostal = filtered.filter(c => !c.postalCode).length;

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
        Distrikt: `D${c.district.number} – ${c.district.name}`,
        Kundnr: `D${c.district.number}-${c.customerNumber}`,
        Namn: c.name,
        Typ: typeLabels[c.type] ?? c.type,
        Kontaktperson: c.contactPerson ?? "",
        Kontaktroll: c.contactRole ?? "",
        Telefon: c.phone ?? "",
        "E-post": c.email ?? "",
        Adress: c.address ?? "",
        Postnummer: formatPostalCode(c.postalCode, c.district.region) || "SAKNAS",
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
        wch: h === "Namn" || h === "Adress" || h === "Kommentar" || h === "E-post" || h === "Distrikt" ? 26 : 15,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kunder");
      XLSX.writeFile(wb, `Alla_kunder_besok_${label.replace(/\s+/g, "_") || "lista"}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  async function approve(ids?: string[]) {
    setWorking(ids && ids.length === 1 ? ids[0] : "bulk");
    setMessage("");
    const res = await fetch("/api/admin/customers/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    if (res.ok) {
      const { count } = await res.json();
      setCustomers(prev => prev.map(c =>
        (ids ? ids.includes(c.id) : !c.approved) ? { ...c, approved: true } : c
      ));
      setMessage(`${count} kund${count === 1 ? "" : "er"} godkänd${count === 1 ? "" : "a"}.`);
    } else {
      setMessage("Något gick fel vid godkännande.");
    }
    setWorking(null);
  }

  async function saveType() {
    if (!typeEdit) return;
    const { customer, valdTyp } = typeEdit;
    setWorking(customer.id);
    setMessage("");
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: valdTyp }),
    });
    if (res.ok) {
      setCustomers(prev => prev.map(c => (c.id === customer.id ? { ...c, type: valdTyp } : c)));
      setMessage(`${customer.name} är nu ${typeLabels[valdTyp] ?? valdTyp}.`);
      setTypeEdit(null);
    } else {
      setMessage("Kunde inte ändra kundtyp.");
    }
    setWorking(null);
  }

  return (
    <>
      {typeEdit && (
        <TypeEditDialog
          customer={typeEdit.customer}
          valdTyp={typeEdit.valdTyp}
          working={working === typeEdit.customer.id}
          onChangeValdTyp={v => setTypeEdit({ ...typeEdit, valdTyp: v })}
          onSave={saveType}
          onClose={() => setTypeEdit(null)}
        />
      )}

      {/* Granskningsbanner */}
      {pendingCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-sm text-amber-800">
            <strong>{pendingCount}</strong> kund{pendingCount === 1 ? "" : "er"} väntar på granskning.
          </span>
          <button
            onClick={() => approve()}
            disabled={working === "bulk"}
            className="ml-auto bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {working === "bulk" ? "Godkänner..." : `Godkänn alla väntande (${pendingCount})`}
          </button>
        </div>
      )}

      {/* Markeringsband — syns så fort minst en kund är ikryssad */}
      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <span className="text-sm text-blue-900">
            <strong>{selected.length}</strong> kund{selected.length === 1 ? "" : "er"} markerad{selected.length === 1 ? "" : "e"}
          </span>
          {selected.length === 2 ? (
            <button
              onClick={() => loadMergePreview(selected[0], selected[1])}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Slå ihop
            </button>
          ) : (
            <span className="text-sm text-blue-700">
              {selected.length === 1 ? "Markera en till för att slå ihop." : "Slå ihop tar exakt två kunder åt gången."}
            </span>
          )}
          <button
            onClick={() => setSelected([])}
            className="ml-auto text-sm text-slate-500 hover:text-slate-700"
          >
            Avmarkera
          </button>
        </div>
      )}

      {message && <p className="mb-4 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">{message}</p>}

      {/* Filter-rad */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Sök namn, distrikt..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="ALL">Alla typer</option>
          {Object.entries(typeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={reviewFilter}
          onChange={e => setReviewFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="ALL">All granskning</option>
          <option value="pending">Väntar granskning</option>
          <option value="approved">Godkända</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="active">Aktiva</option>
          <option value="inactive">Inaktiva</option>
          <option value="ALL">Alla</option>
        </select>
        <select
          value={postalFilter}
          onChange={e => setPostalFilter(e.target.value)}
          aria-label="Filtrera på postnummer"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="ALL">Alla postnummer</option>
          <option value="missing">Saknar postnummer</option>
          <option value="has">Har postnummer</option>
        </select>
        <select
          value={materialFilter}
          onChange={e => setMaterialFilter(e.target.value as MaterialFilter)}
          aria-label="Filtrera säljmaterial"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {materialFilterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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
            <button onClick={exportXlsx} disabled={exporting} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg">
              {exporting ? "Exporterar…" : "Excel"}
            </button>
          </>
        )}
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} av {customers.length}
        </span>
      </div>
      {seasonStats && (
        <p className="mb-4 -mt-2 text-xs text-slate-500">
          {seasons.find(s => s.id === season)?.label}: <span className="text-blue-600 font-medium">{seasonStats.multi} med återbesök</span> · {seasonStats.none} ej besökta
        </p>
      )}

      {/* Täckning för postnummer i det urval som visas */}
      <p className="mb-4 -mt-2 text-xs text-slate-500">
        Postnummer:{" "}
        {missingPostal === 0 ? (
          <span className="text-green-700 font-medium">alla {filtered.length} har postnummer</span>
        ) : (
          <>
            <span className="text-amber-700 font-medium">{missingPostal} av {filtered.length} saknar</span>
            {postalFilter !== "missing" && (
              <>
                {" · "}
                <button onClick={() => setPostalFilter("missing")} className="text-blue-600 hover:underline">
                  visa dem
                </button>
              </>
            )}
          </>
        )}
      </p>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="w-10 px-3 py-3">
                  <span className="sr-only">Markera för sammanslagning</span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Distrikt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Typ</th>
                {seasons.length > 0 && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Besök</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Material</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Postnr</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ort</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Granskning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className={`hover:bg-slate-50 ${!c.active ? "opacity-50" : ""} ${selected.includes(c.id) ? "bg-blue-50" : seasons.length > 0 && visitCount(c.id) >= 2 ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      aria-label={`Markera ${c.name} för sammanslagning`}
                      className="w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-medium whitespace-nowrap">
                    D{c.district.number} – {c.district.name}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/kunder/${c.id}`} className="text-slate-800 hover:text-blue-700 hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-[11px] text-slate-400 font-normal">D{c.district.number}-{c.customerNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setTypeEdit({ customer: c, valdTyp: c.type })}
                      title="Ändra kundtyp"
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium hover:ring-2 hover:ring-blue-400 transition ${typeColors[c.type] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {typeLabels[c.type] ?? c.type}
                    </button>
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.postalCode ? (
                      <span className="text-slate-600 tabular-nums">
                        {formatPostalCode(c.postalCode, c.district.region)}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Saknas
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.city ?? "–"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {c.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.approved ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Godkänd</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Väntar</span>
                        <button
                          onClick={() => approve([c.id])}
                          disabled={working === c.id}
                          className="text-xs text-green-700 hover:underline font-medium"
                        >
                          {working === c.id ? "..." : "Godkänn"}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={seasons.length > 0 ? 11 : 10} className="px-4 py-10 text-center text-slate-400">
                    {customers.length === 0 ? (
                      "Inga kunder registrerade än."
                    ) : hasActiveFilter ? (
                      <>
                        Inga kunder matchar sökningen.{" "}
                        <button onClick={resetFilters} className="text-blue-600 hover:text-blue-700 font-medium">
                          Rensa filter
                        </button>
                      </>
                    ) : (
                      "Inga kunder matchar sökningen."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sammanslagning: granskning innan något raderas */}
      {merge && (
        <MergeDialog
          merge={merge}
          onSelectKeep={id => loadMergePreview(id, merge.preview!.keep.id)}
          onConfirm={confirmMerge}
          onClose={() => setMerge(null)}
        />
      )}
    </>
  );
}

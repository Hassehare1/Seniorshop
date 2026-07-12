"use client";

import { useMemo, useState } from "react";
import { formatSEK } from "@/lib/fees";
import { customerTypeLabels, customerTypeOptions } from "@/lib/customerTypes";

// En rad = ett besök (en kund en vecka). Plattas ihop server-sidan i page.tsx.
export interface SalesRow {
  id: string;
  week: number;
  year: number;
  seasonType: string;       // "VAR" | "HOST"
  seasonLabel: string;      // "Höst 2025"
  districtId: string;
  districtLabel: string;    // "D6 – Borås"
  districtNumber: number;
  customerName: string;
  customerType: string;
  numberOfCustomers: number;
  sales: number;            // ink. moms (sales + ev. fashionShowSales)
  isFashionShow: boolean;
  isHangerShow: boolean;
  ftFee: number;
  mfFee: number;
  totalToPay: number;
  status: string;           // DRAFT | SUBMITTED | APPROVED
  comment: string | null;
}

interface Props {
  rows: SalesRow[];
  isAdmin: boolean;
  defaultYear: number | null;
  defaultSeasonType: string | null;
}

const statusLabels: Record<string, string> = {
  DRAFT: "Utkast",
  SUBMITTED: "Inlämnad",
  APPROVED: "Godkänd",
};
const statusClasses: Record<string, string> = {
  DRAFT: "text-slate-400",
  SUBMITTED: "text-amber-600",
  APPROVED: "text-green-600",
};

type SortKey =
  | "week" | "districtNumber" | "customerName" | "customerType"
  | "numberOfCustomers" | "sales" | "totalToPay" | "status";

export default function ForsaljningClient({ rows, isAdmin, defaultYear, defaultSeasonType }: Props) {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>(defaultYear != null ? String(defaultYear) : "all");
  const [season, setSeason] = useState<string>(defaultSeasonType ?? "all");
  const [district, setDistrict] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("week");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [copied, setCopied] = useState(false);

  // Filteralternativ härleds ur datan (en sann källa)
  const years = useMemo(
    () => Array.from(new Set(rows.map(r => r.year))).sort((a, b) => b - a),
    [rows]
  );
  const districts = useMemo(() => {
    const map = new Map<string, { id: string; label: string; number: number }>();
    for (const r of rows) if (!map.has(r.districtId)) map.set(r.districtId, { id: r.districtId, label: r.districtLabel, number: r.districtNumber });
    return Array.from(map.values()).sort((a, b) => a.number - b.number);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter(r =>
      (year === "all" || r.year === Number(year)) &&
      (season === "all" || r.seasonType === season) &&
      (!isAdmin || district === "all" || r.districtId === district) &&
      (type === "all" || r.customerType === type) &&
      (status === "all" || r.status === status) &&
      (q === "" ||
        r.customerName.toLowerCase().includes(q) ||
        (customerTypeLabels[r.customerType] ?? "").toLowerCase().includes(q) ||
        (isAdmin && r.districtLabel.toLowerCase().includes(q)))
    );
    const dir = sortDir === "asc" ? 1 : -1;
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "customerName": cmp = a.customerName.localeCompare(b.customerName, "sv"); break;
        case "customerType": cmp = (customerTypeLabels[a.customerType] ?? "").localeCompare(customerTypeLabels[b.customerType] ?? "", "sv"); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "districtNumber": cmp = a.districtNumber - b.districtNumber; break;
        default: cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      // Sekundär: vecka, sedan kundnamn — stabil och läsbar
      if (cmp === 0) cmp = a.week - b.week || a.customerName.localeCompare(b.customerName, "sv");
      return cmp * dir;
    });
    return result;
  }, [rows, search, year, season, district, type, status, sortKey, sortDir, isAdmin]);

  const sums = useMemo(() => filtered.reduce(
    (acc, r) => {
      acc.numberOfCustomers += r.numberOfCustomers;
      acc.sales += r.sales;
      acc.ftFee += r.ftFee;
      acc.mfFee += r.mfFee;
      acc.totalToPay += r.totalToPay;
      return acc;
    },
    { numberOfCustomers: 0, sales: 0, ftFee: 0, mfFee: 0, totalToPay: 0 }
  ), [filtered]);

  // Rubrik för summabanden + kopiera-texten: aktiva filter + antal rader
  const summaryCaption = `${filterText()} · ${filtered.length} ${filtered.length === 1 ? "rad" : "rader"}`;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "sales" || key === "totalToPay" || key === "numberOfCustomers" ? "desc" : "asc"); }
  }

  // Textbeskrivning av aktiva filter — används av Kopiera-knappen och exportlänken
  function filterParams() {
    const p = new URLSearchParams();
    if (year !== "all") p.set("year", year);
    if (season !== "all") p.set("season", season);
    if (isAdmin && district !== "all") p.set("district", district);
    if (type !== "all") p.set("type", type);
    if (status !== "all") p.set("status", status);
    if (search.trim()) p.set("q", search.trim());
    return p;
  }

  function filterText() {
    const parts: string[] = [];
    parts.push(season === "all" && year === "all"
      ? "alla säsonger"
      : `${season === "VAR" ? "Vår" : season === "HOST" ? "Höst" : ""}${year !== "all" ? ` ${year}` : ""}`.trim() || `år ${year}`);
    if (isAdmin) parts.push(district === "all" ? "alla distrikt" : (districts.find(d => d.id === district)?.label ?? district));
    if (type !== "all") parts.push(customerTypeLabels[type] ?? type);
    if (status !== "all") parts.push(statusLabels[status] ?? status);
    if (search.trim()) parts.push(`sök: "${search.trim()}"`);
    return parts.join(" · ");
  }

  async function copySummary() {
    const text =
      `${summaryCaption}\n` +
      `Försäljning ${formatSEK(sums.sales)} · Antal ${sums.numberOfCustomers} · ` +
      `FT-avgift ${formatSEK(sums.ftFee)}${isAdmin ? ` · MF-avgift ${formatSEK(sums.mfFee)}` : ""} · ` +
      `Att betala ${formatSEK(sums.totalToPay)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard kan nekas — ignorera tyst */ }
  }

  function exportExcel() {
    const p = filterParams();
    window.location.href = `/api/forsaljning/export?${p.toString()}`;
  }

  const selectClass = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const arrow = (k: SortKey) =>
    sortKey === k ? <span className="text-slate-400">{sortDir === "asc" ? " ↑" : " ↓"}</span> : null;
  const th = "text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 whitespace-nowrap";

  return (
    <div className="space-y-4">
      {/* Filterrad */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Sök kund, typ…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={year} onChange={e => setYear(e.target.value)} className={selectClass} aria-label="Filtrera år">
          <option value="all">Alla år</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={season} onChange={e => setSeason(e.target.value)} className={selectClass} aria-label="Filtrera säsong">
          <option value="all">Alla säsonger</option>
          <option value="VAR">Vår</option>
          <option value="HOST">Höst</option>
        </select>
        {isAdmin && (
          <select value={district} onChange={e => setDistrict(e.target.value)} className={selectClass} aria-label="Filtrera distrikt">
            <option value="all">Alla distrikt</option>
            {districts.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        )}
        <select value={type} onChange={e => setType(e.target.value)} className={selectClass} aria-label="Filtrera kundtyp">
          <option value="all">Alla typer</option>
          {customerTypeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass} aria-label="Filtrera status">
          <option value="all">Alla statusar</option>
          <option value="DRAFT">Utkast</option>
          <option value="SUBMITTED">Inlämnad</option>
          <option value="APPROVED">Godkänd</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={copySummary}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {copied ? "Kopierat ✓" : "Kopiera sammanfattning"}
        </button>
        <button
          onClick={exportExcel}
          disabled={filtered.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Exportera till Excel
        </button>
      </div>

      {/* Topp-summa — filterrubrik + siffror, tydligt skilt från tabellen */}
      <SummaryBand caption={summaryCaption} sums={sums} isAdmin={isAdmin} />

      {/* Tabell */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className={th} onClick={() => toggleSort("week")}>Vecka{arrow("week")}</th>
                {isAdmin && <th className={th} onClick={() => toggleSort("districtNumber")}>Distrikt{arrow("districtNumber")}</th>}
                <th className={th} onClick={() => toggleSort("customerName")}>Kund{arrow("customerName")}</th>
                <th className={th} onClick={() => toggleSort("customerType")}>Typ{arrow("customerType")}</th>
                <th className={`${th} text-right`} onClick={() => toggleSort("numberOfCustomers")}>Antal{arrow("numberOfCustomers")}</th>
                <th className={`${th} text-right`} onClick={() => toggleSort("sales")}>Försäljning{arrow("sales")}</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Visning</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">FT-avgift</th>
                {isAdmin && <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">MF-avgift</th>}
                <th className={`${th} text-right`} onClick={() => toggleSort("totalToPay")}>Att betala{arrow("totalToPay")}</th>
                <th className={th} onClick={() => toggleSort("status")}>Status{arrow("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-700">{r.week}</td>
                  {isAdmin && <td className="px-3 py-2.5 text-blue-700 whitespace-nowrap">{r.districtLabel}</td>}
                  <td className="px-3 py-2.5 text-slate-800">{r.customerName}</td>
                  <td className="px-3 py-2.5 text-slate-500">{customerTypeLabels[r.customerType] ?? r.customerType}</td>
                  <td className="px-3 py-2.5 text-right">{r.numberOfCustomers}</td>
                  <td className="px-3 py-2.5 text-right">{formatSEK(r.sales)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {r.isFashionShow && <span className="text-purple-600">Mode</span>}
                    {r.isFashionShow && r.isHangerShow && " · "}
                    {r.isHangerShow && <span className="text-teal-600">Galge</span>}
                    {!r.isFashionShow && !r.isHangerShow && "–"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{formatSEK(r.ftFee)}</td>
                  {isAdmin && <td className="px-3 py-2.5 text-right text-slate-500">{formatSEK(r.mfFee)}</td>}
                  <td className="px-3 py-2.5 text-right font-medium">{formatSEK(r.totalToPay)}</td>
                  <td className="px-3 py-2.5"><span className={`text-xs font-medium ${statusClasses[r.status] ?? "text-slate-500"}`}>{statusLabels[r.status] ?? r.status}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 9} className="px-4 py-10 text-center text-slate-400">
                    {rows.length === 0 ? "Inga försäljningar rapporterade än." : "Inga rader matchar filtret."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Botten-summa — samma band igen, så totalen syns efter scroll i långa listor */}
      {filtered.length > 0 && <SummaryBand caption={summaryCaption} sums={sums} isAdmin={isAdmin} />}
    </div>
  );
}

type Sums = { numberOfCustomers: number; sales: number; ftFee: number; mfFee: number; totalToPay: number };

function SummaryBand({ caption, sums, isAdmin }: { caption: string; sums: Sums; isAdmin: boolean }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">{caption}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="text-sm text-blue-800">Försäljning <strong>{formatSEK(sums.sales)}</strong></span>
        <span className="text-sm text-blue-800">Antal <strong>{sums.numberOfCustomers}</strong></span>
        <span className="text-sm text-blue-800">FT-avgift <strong>{formatSEK(sums.ftFee)}</strong></span>
        {isAdmin && <span className="text-sm text-blue-800">MF-avgift <strong>{formatSEK(sums.mfFee)}</strong></span>}
        <span className="text-sm text-blue-800">Att betala <strong>{formatSEK(sums.totalToPay)}</strong></span>
      </div>
    </div>
  );
}

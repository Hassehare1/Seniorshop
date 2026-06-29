"use client";

import { useState } from "react";
import Link from "next/link";
import {
  customerTypeLabels as typeLabels,
  customerTypeColors as typeColors,
} from "@/lib/customerTypes";

interface Customer {
  id: string;
  name: string;
  type: string;
  contactPerson: string | null;
  contactRole: string | null;
  email: string | null;
  phone: string | null;
  size: number | null;
  active: boolean;
  approved: boolean;
  district: { number: number; name: string };
}

export type VisitMap = Record<string, Record<string, { count: number; lastWeek: number }>>;

interface Props {
  customers: Customer[];
  seasons: { id: string; label: string }[];
  visitMap: VisitMap;
  defaultSeasonId: string;
}

export default function AdminKunderClient({ customers: initial, seasons, visitMap, defaultSeasonId }: Props) {
  const [customers, setCustomers] = useState(initial);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("active");
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [season, setSeason] = useState(defaultSeasonId);
  const [visitFilter, setVisitFilter] = useState("all");
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
    return matchSearch && matchType && matchStatus && matchReview && matchVisit;
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
      const rows = filtered.map(c => ({
        Distrikt: `D${c.district.number} – ${c.district.name}`,
        Namn: c.name,
        Typ: typeLabels[c.type] ?? c.type,
        [`Besök ${label}`]: visitCount(c.id),
        "Senaste vecka": lastWeek(c.id) || "",
        Status: c.active ? "Aktiv" : "Inaktiv",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
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

  return (
    <>
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Distrikt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Typ</th>
                {seasons.length > 0 && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Besök</th>}
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Storlek</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Granskning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className={`hover:bg-slate-50 ${!c.active ? "opacity-50" : ""} ${seasons.length > 0 && visitCount(c.id) >= 2 ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3 text-slate-500 text-xs font-medium whitespace-nowrap">
                    D{c.district.number} – {c.district.name}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/kunder/${c.id}`} className="text-slate-800 hover:text-blue-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[c.type] ?? "bg-slate-100 text-slate-600"}`}>
                      {typeLabels[c.type] ?? c.type}
                    </span>
                  </td>
                  {seasons.length > 0 && <td className="px-4 py-3">{besokBadge(visitCount(c.id))}</td>}
                  <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{c.size ?? "–"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.contactPerson ?? "–"}
                    {c.contactRole && <span className="text-slate-400"> · {c.contactRole}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.phone ?? "–"}</td>
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
                  <td colSpan={seasons.length > 0 ? 9 : 8} className="px-4 py-10 text-center text-slate-400">
                    Inga kunder matchar sökningen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
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
  district: { number: number; name: string };
}

export default function AdminKunderClient({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("active");

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
    return matchSearch && matchType && matchStatus;
  });

  return (
    <>
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
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="active">Aktiva</option>
          <option value="inactive">Inaktiva</option>
          <option value="ALL">Alla</option>
        </select>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} av {customers.length}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Distrikt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Typ</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Storlek</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-post</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className={`hover:bg-slate-50 ${!c.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 text-slate-500 text-xs font-medium whitespace-nowrap">
                    D{c.district.number} – {c.district.name}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[c.type] ?? "bg-slate-100 text-slate-600"}`}>
                      {typeLabels[c.type] ?? c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{c.size ?? "–"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.contactPerson ?? "–"}
                    {c.contactRole && <span className="text-slate-400"> · {c.contactRole}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.phone ?? "–"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email ?? "–"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {c.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Report {
  id: string;
  week: number;
  status: string;
  visits: { totalToPay: number }[];
}

interface District {
  id: string;
  number: number;
  name: string;
  users: { name: string | null; email: string }[];
  reports: Report[];
}

interface Props {
  districts: District[];
  weeks: number[];
  currentWeek: number;
  seasonId: string;
  seasonLabel: string;
  allSeasons: { id: string; label: string }[];
}

const statusLabel: Record<string, string> = {
  DRAFT: "Utkast",
  SUBMITTED: "Inlämnad",
  APPROVED: "Godkänd",
};

const statusStyle: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-500",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

export default function AdminRapporterClient({
  districts: initial, weeks, currentWeek, seasonId, seasonLabel, allSeasons,
}: Props) {
  const router = useRouter();
  const [districts, setDistricts] = useState(initial);
  const [working, setWorking] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function setStatus(reportId: string, status: string) {
    setWorking(reportId);
    setMessage("");
    const res = await fetch(`/api/reports/${reportId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setDistricts(prev => prev.map(d => ({
        ...d,
        reports: d.reports.map(r => r.id === reportId ? { ...r, status } : r),
      })));
    }
    setWorking(null);
  }

  async function bulkApprove() {
    const count = districts.flatMap(d => d.reports).filter(r => r.status === "SUBMITTED").length;
    if (!count) { setMessage("Inga inlämnade rapporter att godkänna."); return; }
    if (!confirm(`Godkänn alla ${count} inlämnade rapporter för ${seasonLabel}?`)) return;
    setBulkWorking(true);
    setMessage("");
    const res = await fetch("/api/admin/reports/bulk-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seasonId }),
    });
    if (res.ok) {
      const { approved } = await res.json();
      setDistricts(prev => prev.map(d => ({
        ...d,
        reports: d.reports.map(r => r.status === "SUBMITTED" ? { ...r, status: "APPROVED" } : r),
      })));
      setMessage(`✓ ${approved} rapporter godkändes.`);
    }
    setBulkWorking(false);
  }

  const submittedCount = districts.flatMap(d => d.reports).filter(r => r.status === "SUBMITTED").length;
  const totalDistricts = districts.length;
  const reportedCount = districts.filter(d =>
    d.reports.some(r => r.status === "SUBMITTED" || r.status === "APPROVED")
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rapportstatus</h1>
          <p className="text-slate-500 text-sm mt-1">{seasonLabel}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {reportedCount} av {totalDistricts} distrikt har lämnat in
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Säsongsväljare */}
          {allSeasons.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Säsong:</span>
              <select
                value={seasonId}
                onChange={e => router.push(`/admin/rapporter?season=${e.target.value}`)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {allSeasons.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
          {/* Exportknapp */}
          <a
            href={`/api/admin/reports/export?seasonId=${seasonId}`}
            download
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            ↓ Exportera Excel
          </a>
          {/* Bulk-godkänn */}
          <button
            onClick={bulkApprove}
            disabled={bulkWorking || submittedCount === 0}
            className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-400 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {bulkWorking ? "Godkänner..." : `Godkänn alla inlämnade (${submittedCount})`}
          </button>
        </div>
      </div>

      {message && <p className="mb-4 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">{message}</p>}

      <div className="overflow-x-auto">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden inline-block min-w-full">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="sticky left-0 bg-slate-50 text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Distrikt</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">FT</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Totalt</th>
                {weeks.map(w => (
                  <th
                    key={w}
                    className={`px-2 py-3 text-xs font-semibold uppercase tracking-wide text-center whitespace-nowrap ${w === currentWeek ? "text-blue-600" : "text-slate-400"}`}
                  >
                    v{w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {districts.map(d => {
                const reportMap = new Map(d.reports.map(r => [r.week, r]));
                const totalPay = d.reports.reduce((s, r) => s + r.visits.reduce((vs, v) => vs + v.totalToPay, 0), 0);
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 bg-white px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      D{d.number} – {d.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {d.users.map(u => u.name ?? u.email).join(", ") || "–"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">
                      {totalPay > 0 ? fmt(totalPay) : "–"}
                    </td>
                    {weeks.map(w => {
                      const report = reportMap.get(w);
                      const isPast = w < currentWeek;
                      if (!report) {
                        return (
                          <td key={w} className="px-2 py-3 text-center">
                            {isPast
                              ? <span className="inline-flex w-5 h-5 rounded-full bg-red-100 text-red-500 text-xs items-center justify-center" title="Ej rapporterad">✗</span>
                              : <span className="inline-block w-2 h-2 rounded-full bg-slate-200 mx-auto"></span>
                            }
                          </td>
                        );
                      }
                      return (
                        <td key={w} className="px-1 py-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${statusStyle[report.status]}`}>
                              {statusLabel[report.status]}
                            </span>
                            <div className="flex gap-0.5 mt-0.5">
                              {report.status === "SUBMITTED" && (
                                <button
                                  onClick={() => setStatus(report.id, "APPROVED")}
                                  disabled={working === report.id}
                                  className="text-xs text-green-700 hover:underline whitespace-nowrap"
                                >Godkänn</button>
                              )}
                              {report.status !== "DRAFT" && (
                                <button
                                  onClick={() => setStatus(report.id, "DRAFT")}
                                  disabled={working === report.id}
                                  className="text-xs text-slate-400 hover:text-slate-600 hover:underline whitespace-nowrap ml-1"
                                >Lås upp</button>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">Inlämnad</span> FT har låst</span>
        <span className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs">Godkänd</span> Admin-godkänd, permanent</span>
        <span className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-xs">Utkast</span> Ej låst av FT</span>
        <span className="flex items-center gap-1.5"><span className="inline-flex w-4 h-4 rounded-full bg-red-100 text-red-500 text-xs items-center justify-center">✗</span> Ej rapporterad (passerad vecka)</span>
      </div>
    </div>
  );
}

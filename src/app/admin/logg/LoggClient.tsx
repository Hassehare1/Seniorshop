"use client";

import { useState } from "react";

const actionLabels: Record<string, { label: string; color: string }> = {
  RAPPORT_INLÄMNAD:      { label: "Rapport inlämnad",       color: "bg-blue-100 text-blue-700" },
  RAPPORT_GODKÄND:       { label: "Rapport godkänd",        color: "bg-green-100 text-green-700" },
  RAPPORT_UPPLÅST:       { label: "Rapport upplåst (FT)",   color: "bg-amber-100 text-amber-700" },
  RAPPORT_UPPLÅST_ADMIN: { label: "Rapport upplåst (admin)", color: "bg-orange-100 text-orange-700" },
  AVGIFTER_UPPDATERADE:  { label: "Avgifter uppdaterade",   color: "bg-purple-100 text-purple-700" },
};

function fmt(d: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

interface LogEntry {
  id: string;
  action: string;
  userEmail: string | null;
  details: string | null;
  createdAt: string;
}

export default function LoggClient({ logs }: { logs: LogEntry[] }) {
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL" ? logs : logs.filter(l => l.action === filter);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-slate-500">Filtrera:</span>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="ALL">Alla händelser</option>
          {Object.entries(actionLabels).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        {filter !== "ALL" && (
          <span className="text-xs text-slate-400">{filtered.length} träff{filtered.length !== 1 ? "ar" : ""}</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          Inga händelser matchar filtret.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tid</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Händelse</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Utförd av</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Distrikt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Detaljer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(log => {
                  const style = actionLabels[log.action] ?? { label: log.action, color: "bg-slate-100 text-slate-600" };
                  let details: Record<string, unknown> = {};
                  try { details = JSON.parse(log.details ?? "{}"); } catch {}

                  const districtLabel = details.districtNr != null
                    ? `D${details.districtNr}${details.districtName ? ` – ${details.districtName}` : ""}`
                    : null;

                  let detailText = "";
                  if (details.vecka) detailText += `Vecka ${details.vecka}`;
                  if (details.från && details.till) detailText += ` · ${details.från} → ${details.till}`;
                  if (details.bulk) detailText += " (bulk)";
                  if (details.ftFeePercent !== undefined) {
                    detailText += `FT ${((Number(details.ftFeePercent)) * 100).toFixed(1)}% / MF ${((Number(details.mfFeePercent)) * 100).toFixed(1)}%`;
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {fmt(new Date(log.createdAt))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style.color}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {log.userEmail ?? "–"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                        {districtLabel ?? "–"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {detailText || "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

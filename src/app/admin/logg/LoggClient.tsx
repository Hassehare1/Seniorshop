"use client";

import { useState } from "react";
import { customerTypeLabels } from "@/lib/customerTypes";

const actionLabels: Record<string, { label: string; color: string }> = {
  RAPPORT_INLÄMNAD:      { label: "Rapport inlämnad",        color: "bg-blue-100 text-blue-700" },
  RAPPORT_GODKÄND:       { label: "Rapport godkänd",         color: "bg-green-100 text-green-700" },
  RAPPORT_UPPLÅST:       { label: "Rapport upplåst (FT)",    color: "bg-amber-100 text-amber-700" },
  RAPPORT_UPPLÅST_ADMIN: { label: "Rapport upplåst (admin)", color: "bg-orange-100 text-orange-700" },
  AVGIFTER_UPPDATERADE:  { label: "Avgifter uppdaterade",    color: "bg-purple-100 text-purple-700" },
  ANVÄNDARE_SKAPAD:      { label: "Användare skapad",        color: "bg-teal-100 text-teal-700" },
  ANVÄNDARE_ÄNDRAD:      { label: "Användare ändrad",        color: "bg-indigo-100 text-indigo-700" },
  KUND_SKAPAD:           { label: "Kund skapad",             color: "bg-emerald-100 text-emerald-700" },
  KUND_ÄNDRAD:           { label: "Kund ändrad",             color: "bg-cyan-100 text-cyan-700" },
  KUND_GODKÄND:          { label: "Kund godkänd",            color: "bg-green-100 text-green-700" },
  KUNDER_IMPORTERADE:    { label: "Kunder importerade",      color: "bg-sky-100 text-sky-700" },
  LOGIN_FAILED:          { label: "Misslyckad inloggning",   color: "bg-red-100 text-red-700" },
};

function fmt(d: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

// Bygg läsbar detaljtext per händelsetyp
function describe(action: string, d: Record<string, unknown>): string {
  switch (action) {
    case "ANVÄNDARE_SKAPAD": {
      const parts: string[] = [];
      if (d.email) parts.push(String(d.email));
      if (d.roll) parts.push(d.roll === "ADMIN" ? "Admin" : "Franchisetagare");
      if (d.distrikt) parts.push(String(d.distrikt));
      return parts.join(" · ");
    }
    case "ANVÄNDARE_ÄNDRAD": {
      const parts: string[] = [];
      if (d.konto) parts.push(String(d.konto));
      if (d.roll) parts.push(`roll: ${d.roll}`);
      if (d.distrikt) parts.push(`distrikt: ${d.distrikt}`);
      if (d.spärr) parts.push(`spärr: ${d.spärr}`);
      if (d.email) parts.push(`e-post: ${d.email}`);
      if (d.lösenord) parts.push("lösenord ändrat");
      return parts.join(" · ");
    }
    case "KUND_SKAPAD":
    case "KUND_ÄNDRAD": {
      const parts: string[] = [];
      if (d.namn) parts.push(String(d.namn));
      if (d.typ) parts.push(customerTypeLabels[String(d.typ)] ?? String(d.typ));
      if (d.status) parts.push(String(d.status));
      return parts.join(" · ");
    }
    case "KUND_GODKÄND":
      return d.antal ? `${d.antal} kund${Number(d.antal) === 1 ? "" : "er"}${d.bulk ? " (bulk)" : ""}` : "";
    case "KUNDER_IMPORTERADE":
      return d.antal ? `${d.antal} kunder` : "";
    case "LOGIN_FAILED":
      return "Fel e-post eller lösenord";
    case "AVGIFTER_UPPDATERADE":
      return d.ftFeePercent !== undefined
        ? `FT ${(Number(d.ftFeePercent) * 100).toFixed(1)}% / MF ${(Number(d.mfFeePercent) * 100).toFixed(1)}%`
        : "";
    default: {
      // Rapport-händelser
      let t = "";
      if (d.vecka) t += `Vecka ${d.vecka}`;
      if (d.från && d.till) t += ` · ${d.från} → ${d.till}`;
      if (d.bulk) t += " (bulk)";
      return t;
    }
  }
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
  const [showLogins, setShowLogins] = useState(false);

  const loginFailCount = logs.filter(l => l.action === "LOGIN_FAILED").length;

  let filtered = filter === "ALL" ? logs : logs.filter(l => l.action === filter);
  // Dölj inloggningsbrus i totalvyn om inte uttryckligen påslaget
  if (filter === "ALL" && !showLogins) {
    filtered = filtered.filter(l => l.action !== "LOGIN_FAILED");
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
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
        </div>

        {filter === "ALL" && loginFailCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showLogins}
              onChange={e => setShowLogins(e.target.checked)}
              className="rounded"
            />
            Visa inloggningsförsök
            <span className="inline-block px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              {loginFailCount}
            </span>
          </label>
        )}

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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Utförd av / konto</th>
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

                  const detailText = describe(log.action, details);

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

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const actionLabels: Record<string, { label: string; color: string }> = {
  RAPPORT_INLÄMNAD:     { label: "Rapport inlämnad",     color: "bg-blue-100 text-blue-700" },
  RAPPORT_GODKÄND:      { label: "Rapport godkänd",      color: "bg-green-100 text-green-700" },
  RAPPORT_UPPLÅST:      { label: "Rapport upplåst (FT)",  color: "bg-amber-100 text-amber-700" },
  RAPPORT_UPPLÅST_ADMIN:{ label: "Rapport upplåst (admin)", color: "bg-orange-100 text-orange-700" },
  AVGIFTER_UPPDATERADE: { label: "Avgifter uppdaterade",  color: "bg-purple-100 text-purple-700" },
};

function fmt(d: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default async function LoggPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Händelselogg</h1>
        <p className="text-slate-500 text-sm mt-1">Senaste {logs.length} händelserna</p>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          Inga händelser loggade ännu.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tid</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Händelse</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Utförd av</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Detaljer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => {
                  const style = actionLabels[log.action] ?? { label: log.action, color: "bg-slate-100 text-slate-600" };
                  let details: Record<string, unknown> = {};
                  try { details = JSON.parse(log.details ?? "{}"); } catch {}

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
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {details.vecka ? `Vecka ${details.vecka}` : ""}
                        {details.från && details.till ? ` · ${details.från} → ${details.till}` : ""}
                        {details.ftFeePercent !== undefined
                          ? `FT ${((Number(details.ftFeePercent)) * 100).toFixed(1)}% / MF ${((Number(details.mfFeePercent)) * 100).toFixed(1)}%`
                          : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

const typeLabels: Record<string, string> = {
  VARDHEM: "Vårdhem", FORENING: "Förening", TRAFFPUNKT: "Träffpunkt",
  BOENDE_55: "Boende +55", OVRIGT: "Övrigt",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

type Visit = {
  id: string; customerName: string; customerType: string;
  numberOfCustomers: number; sales: number; isFashionShow: boolean;
  ftFee: number; mfFee: number; totalToPay: number; comment: string | null;
};

type ReportRow = {
  id: string; week: number; status: string;
  totalSales: number; totalToPay: number; totalCustomers: number;
  visits: Visit[];
};

export default function WeeklyReportList({ reports }: { reports: ReportRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Rapporterade veckor</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {reports.map(r => {
          const isOpen = open.has(r.id);
          return (
            <div key={r.id}>
              <button
                onClick={() => toggle(r.id)}
                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
              >
                <span className="text-slate-400 text-xs w-4">{isOpen ? "▾" : "▸"}</span>
                <span className="font-medium text-slate-800 w-20">Vecka {r.week}</span>
                <span className="flex-1 text-sm text-slate-500">{r.visits.length} besök · {r.totalCustomers} kunder</span>
                <span className="text-sm font-medium text-slate-700">{fmt(r.totalSales)}</span>
                <span className="text-sm font-bold text-blue-700 w-32 text-right">{fmt(r.totalToPay)} att betala</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${
                  r.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-600"
                }`}>
                  {r.status === "APPROVED" ? "Godkänd" : "Inlämnad"}
                </span>
              </button>

              {isOpen && (
                <div className="bg-slate-50 border-t border-slate-100 px-6 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 uppercase tracking-wide">
                        <th className="text-left pb-2 font-semibold">Kund</th>
                        <th className="text-left pb-2 font-semibold">Typ</th>
                        <th className="text-right pb-2 font-semibold">Kunder</th>
                        <th className="text-right pb-2 font-semibold">Försäljning</th>
                        <th className="text-right pb-2 font-semibold">FT-avg</th>
                        <th className="text-right pb-2 font-semibold">MF-avg</th>
                        <th className="text-right pb-2 font-semibold">Att betala</th>
                        <th className="text-left pb-2 font-semibold pl-4">Kommentar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {r.visits.map(v => (
                        <tr key={v.id} className="text-slate-700">
                          <td className="py-2 font-medium">
                            {v.customerName}
                            {v.isFashionShow && <span className="ml-1 text-xs text-purple-600 font-normal">(modevisning)</span>}
                          </td>
                          <td className="py-2 text-slate-500 text-xs">{typeLabels[v.customerType] ?? v.customerType}</td>
                          <td className="py-2 text-right">{v.numberOfCustomers}</td>
                          <td className="py-2 text-right">{fmt(v.sales)}</td>
                          <td className="py-2 text-right text-slate-500">{fmt(v.ftFee)}</td>
                          <td className="py-2 text-right text-slate-500">{fmt(v.mfFee)}</td>
                          <td className="py-2 text-right font-medium">{fmt(v.totalToPay)}</td>
                          <td className="py-2 pl-4 text-slate-400 text-xs">{v.comment ?? "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-300 font-semibold text-slate-800">
                        <td colSpan={3} className="pt-2">Summa vecka {r.week}</td>
                        <td className="pt-2 text-right">{fmt(r.totalSales)}</td>
                        <td colSpan={2} className="pt-2"></td>
                        <td className="pt-2 text-right text-blue-700">{fmt(r.totalToPay)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

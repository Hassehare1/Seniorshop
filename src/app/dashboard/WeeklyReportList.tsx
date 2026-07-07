"use client";

import Link from "next/link";
import { useState } from "react";
import { formatSEK as fmt } from "@/lib/fees";
import { customerTypeLabels as typeLabels } from "@/lib/customerTypes";

type Visit = {
  id: string; customerName: string; customerType: string;
  numberOfCustomers: number; sales: number; isFashionShow: boolean; isHangerShow: boolean;
  ftFee: number; mfFee: number; totalToPay: number; comment: string | null;
};

type ReportRow = {
  id: string; week: number; status: string;
  districtNumber: number; districtName: string;
  totalSales: number; totalToPay: number; totalCustomers: number;
  visits: Visit[];
};

interface Props {
  reports: ReportRow[];
  seasonId: string;
  showEditLink?: boolean;
  showDistrict?: boolean;
  showMf?: boolean; // MF-avgiften visas bara för admin
}

export default function WeeklyReportList({ reports, seasonId, showEditLink, showDistrict, showMf = false }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totals = reports.reduce(
    (acc, r) => {
      acc.sales += r.totalSales;
      acc.toPay += r.totalToPay;
      acc.visits += r.visits.length;
      acc.customers += r.totalCustomers;
      return acc;
    },
    { sales: 0, toPay: 0, visits: 0, customers: 0 },
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">Rapporterade veckor</h2>
      </div>
      {/* Kolumnrubriker — desktop */}
      <div className="hidden md:flex items-center gap-4 px-6 py-2 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        <span className="w-4" />
        {showDistrict && <span className="w-40">Distrikt</span>}
        <span className="w-20">Vecka</span>
        <span className="flex-1">Aktivitet</span>
        <span className="w-32 text-right">Försäljning</span>
        <span className="w-32 text-right">Avgift</span>
        <span className="w-24 text-right">Status</span>
      </div>
      <div className="divide-y divide-slate-100">
        {reports.map(r => {
          const isOpen = open.has(r.id);
          const editHref = `/rapportera?week=${r.week}&season=${seasonId}`;

          return (
            <div key={r.id}>
              {/* Rad — klickbar yta för expand/collapse */}
              <div
                onClick={() => toggle(r.id)}
                className="w-full px-4 md:px-6 py-3 md:py-4 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {/* Mobile layout */}
                <div className="flex items-start gap-3 md:hidden">
                  <span className="text-slate-400 text-xs mt-0.5 shrink-0">{isOpen ? "▾" : "▸"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 text-sm">
                        {showDistrict && <span className="text-slate-400 font-normal">D{r.districtNumber} · </span>}
                        Vecka {r.week}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          r.status === "APPROVED" ? "bg-green-100 text-green-700"
                          : r.status === "SUBMITTED" ? "bg-blue-100 text-blue-600"
                          : "bg-slate-100 text-slate-500"
                        }`}>
                          {r.status === "APPROVED" ? "Godkänd" : r.status === "SUBMITTED" ? "Inlämnad" : "Utkast"}
                        </span>
                        {showEditLink && r.status !== "APPROVED" && (
                          <Link
                            href={editHref}
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Öppna →
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-slate-500">{r.visits.length} besök · {r.totalCustomers} kunder</span>
                      <span className="text-xs font-bold text-blue-700">{fmt(r.totalToPay)}</span>
                    </div>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden md:flex items-center gap-4">
                  <span className="text-slate-400 text-xs w-4">{isOpen ? "▾" : "▸"}</span>
                  {showDistrict && (
                    <span className="w-40 text-sm text-slate-500 truncate">D{r.districtNumber} – {r.districtName}</span>
                  )}
                  <span className="font-medium text-slate-800 w-20">Vecka {r.week}</span>
                  <span className="flex-1 text-sm text-slate-500">{r.visits.length} besök · {r.totalCustomers} kunder</span>
                  <span className="w-32 text-right text-sm font-medium text-slate-700">{fmt(r.totalSales)}</span>
                  <span className="w-32 text-right text-sm font-bold text-blue-700">{fmt(r.totalToPay)}</span>
                  <span className="w-24 flex justify-end">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === "APPROVED" ? "bg-green-100 text-green-700"
                      : r.status === "SUBMITTED" ? "bg-blue-100 text-blue-600"
                      : "bg-slate-100 text-slate-500"
                    }`}>
                      {r.status === "APPROVED" ? "Godkänd" : r.status === "SUBMITTED" ? "Inlämnad" : "Utkast"}
                    </span>
                  </span>
                  {showEditLink && r.status !== "APPROVED" && (
                    <Link
                      href={editHref}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-1 shrink-0"
                    >
                      Öppna →
                    </Link>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="bg-slate-50 border-t border-slate-100 px-4 md:px-6 py-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="text-xs text-slate-400 uppercase tracking-wide">
                          <th className="text-left pb-2 font-semibold">Kund</th>
                          <th className="text-left pb-2 font-semibold">Typ</th>
                          <th className="text-right pb-2 font-semibold">Kunder</th>
                          <th className="text-right pb-2 font-semibold">Försäljning</th>
                          <th className="text-right pb-2 font-semibold">FT-avg</th>
                          {showMf && <th className="text-right pb-2 font-semibold">MF-avg</th>}
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
                              {v.isHangerShow && <span className="ml-1 text-xs text-teal-600 font-normal">(galge)</span>}
                            </td>
                            <td className="py-2 text-slate-500 text-xs">{typeLabels[v.customerType] ?? v.customerType}</td>
                            <td className="py-2 text-right">{v.numberOfCustomers}</td>
                            <td className="py-2 text-right">{fmt(v.sales)}</td>
                            <td className="py-2 text-right text-slate-500">{fmt(v.ftFee)}</td>
                            {showMf && <td className="py-2 text-right text-slate-500">{fmt(v.mfFee)}</td>}
                            <td className="py-2 text-right font-medium">{fmt(v.totalToPay)}</td>
                            <td className="py-2 pl-4 text-slate-400 text-xs">{v.comment ?? "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-300 font-semibold text-slate-800">
                          <td colSpan={3} className="pt-2">Summa vecka {r.week}</td>
                          <td className="pt-2 text-right">{fmt(r.totalSales)}</td>
                          <td colSpan={showMf ? 2 : 1} className="pt-2"></td>
                          <td className="pt-2 text-right text-blue-700">{fmt(r.totalToPay)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summarad — totalt för säsongen (efter ev. distriktsfilter) */}
      {reports.length > 0 && (
        <>
          {/* Desktop */}
          <div className="hidden md:flex items-center gap-4 px-6 py-3 border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
            <span className="w-4" />
            {showDistrict && <span className="w-40" />}
            <span className="w-20">Totalt</span>
            <span className="flex-1 font-normal text-slate-500">{totals.visits} besök · {totals.customers} kunder</span>
            <span className="w-32 text-right">{fmt(totals.sales)}</span>
            <span className="w-32 text-right text-blue-700">{fmt(totals.toPay)}</span>
            <span className="w-24" />
          </div>
          {/* Mobil */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm">
            <span className="font-semibold text-slate-700">Totalt · {totals.visits} besök</span>
            <span className="font-bold text-blue-700">{fmt(totals.toPay)}</span>
          </div>
        </>
      )}
    </div>
  );
}

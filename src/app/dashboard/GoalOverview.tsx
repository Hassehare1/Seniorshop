import Link from "next/link";
import { formatSEK } from "@/lib/fees";

type Row = {
  districtId: string;
  label: string;
  goal: { salesTarget: number; visitsTarget: number; avgPerVisitTarget: number; fashionShowsTarget: number };
  actual: { sales: number; visits: number; avgPerVisit: number; fashionShows: number };
};

// Samlad mål-översikt för admin i alla-distrikt-vyn: en rad per FT med mål vs utfall.
export default function GoalOverview({ rows, seasonLabel }: { rows: Row[]; seasonLabel: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6 mb-6">
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Mål och uppföljning — alla distrikt</h2>
        <span className="text-xs text-slate-400">{seasonLabel}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <th className="text-left pb-2 font-semibold">Distrikt</th>
              <th className="text-left pb-2 font-semibold w-[36%]">Försäljning</th>
              <th className="text-right pb-2 font-semibold">Besök</th>
              <th className="text-right pb-2 font-semibold">Snitt / besök</th>
              <th className="text-right pb-2 font-semibold">Modevisn.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => <GoalRow key={r.districtId} {...r} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pair({ actual, target, money }: { actual: number; target: number; money: boolean }) {
  const f = (n: number) => (money ? formatSEK(Math.round(n)) : String(Math.round(n)));
  return (
    <span className="whitespace-nowrap">
      <span className="text-slate-700">{f(actual)}</span>
      <span className="text-slate-400"> / {target > 0 ? f(target) : "–"}</span>
    </span>
  );
}

function GoalRow({ districtId, label, goal, actual }: Row) {
  const hasSalesTarget = goal.salesTarget > 0;
  const pct = hasSalesTarget ? Math.round((actual.sales / goal.salesTarget) * 100) : 0;
  const reached = hasSalesTarget && actual.sales >= goal.salesTarget;

  return (
    <tr className="hover:bg-slate-50">
      <td className="py-2.5 pr-3 align-top">
        <Link href={`/dashboard?district=${districtId}`} className="font-medium text-slate-800 hover:text-blue-700 hover:underline whitespace-nowrap">
          {label}
        </Link>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <div className="flex items-baseline justify-between gap-2 mb-1 text-xs">
          <Pair actual={actual.sales} target={goal.salesTarget} money />
          <span className={reached ? "text-green-600 font-medium" : "text-slate-400"}>{hasSalesTarget ? `${pct}%` : "–"}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${reached ? "bg-green-500" : "bg-blue-600"}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </td>
      <td className="py-2.5 text-right align-top"><Pair actual={actual.visits} target={goal.visitsTarget} money={false} /></td>
      <td className="py-2.5 text-right align-top"><Pair actual={actual.avgPerVisit} target={goal.avgPerVisitTarget} money /></td>
      <td className="py-2.5 text-right align-top"><Pair actual={actual.fashionShows} target={goal.fashionShowsTarget} money={false} /></td>
    </tr>
  );
}

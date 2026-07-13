"use client";

import { useState } from "react";
import { formatSEK } from "@/lib/fees";

type Goal = {
  salesTarget: number;
  visitsTarget: number;
  avgPerVisitTarget: number;
  fashionShowsTarget: number;
};
type Actuals = { sales: number; visits: number; avgPerVisit: number; fashionShows: number };

const emptyForm = { salesTarget: "", visitsTarget: "", avgPerVisitTarget: "", fashionShowsTarget: "" };

export default function GoalTracker({
  districtId,
  seasonId,
  seasonLabel,
  initialGoal,
  actuals,
  canEdit,
}: {
  districtId: string;
  seasonId: string;
  seasonLabel: string;
  initialGoal: Goal | null;
  actuals: Actuals;
  canEdit: boolean;
}) {
  const [goal, setGoal] = useState<Goal | null>(initialGoal);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(toForm(initialGoal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setForm(toForm(goal));
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        districtId,
        seasonId,
        salesTarget: Number(form.salesTarget || 0),
        visitsTarget: Number(form.visitsTarget || 0),
        avgPerVisitTarget: Number(form.avgPerVisitTarget || 0),
        fashionShowsTarget: Number(form.fashionShowsTarget || 0),
      }),
    });
    if (res.ok) {
      const g = await res.json();
      setGoal({
        salesTarget: g.salesTarget,
        visitsTarget: g.visitsTarget,
        avgPerVisitTarget: g.avgPerVisitTarget,
        fashionShowsTarget: g.fashionShowsTarget,
      });
      setEditing(false);
    } else {
      const { error } = await res.json().catch(() => ({ error: "Något gick fel." }));
      setError(error ?? "Något gick fel.");
    }
    setSaving(false);
  }

  const metrics: Metric[] = [
    { label: "Försäljning", target: goal?.salesTarget ?? 0, actual: actuals.sales, money: true, remainLabel: "kvar att sälja för", variance: false },
    { label: "Antal besök", target: goal?.visitsTarget ?? 0, actual: actuals.visits, money: false, remainLabel: "besök kvar", variance: false },
    { label: "Snitt / besök", target: goal?.avgPerVisitTarget ?? 0, actual: actuals.avgPerVisit, money: true, remainLabel: "", variance: true,
      required: goal && goal.salesTarget > 0 && goal.visitsTarget > 0 ? goal.salesTarget / goal.visitsTarget : undefined },
    { label: "Modevisningar", target: goal?.fashionShowsTarget ?? 0, actual: actuals.fashionShows, money: false, remainLabel: "kvar", variance: false },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Mål och uppföljning</h2>
          <span className="text-xs text-slate-400">{seasonLabel}</span>
        </div>
        {canEdit && !editing && (
          <button
            onClick={startEdit}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {goal ? "Ändra mål" : "Sätt mål"}
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditing(false); setError(""); }} disabled={saving} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">
              Avbryt
            </button>
            <button onClick={save} disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              {saving ? "Sparar…" : "Spara mål"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GoalInput label="Mål försäljning (kr)" value={form.salesTarget} onChange={v => setForm(f => ({ ...f, salesTarget: v }))} placeholder="t.ex. 500000" />
          <GoalInput label="Mål antal besök" value={form.visitsTarget} onChange={v => setForm(f => ({ ...f, visitsTarget: v }))} placeholder="t.ex. 60" />
          <GoalInput label="Mål snitt / besök (kr)" value={form.avgPerVisitTarget} onChange={v => setForm(f => ({ ...f, avgPerVisitTarget: v }))} placeholder="t.ex. 20000" />
          <GoalInput label="Mål antal modevisningar" value={form.fashionShowsTarget} onChange={v => setForm(f => ({ ...f, fashionShowsTarget: v }))} placeholder="t.ex. 10" />
        </div>
      ) : goal ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map(m => <MetricCard key={m.label} {...m} />)}
        </div>
      ) : (
        <p className="text-sm text-slate-400 py-2">
          Inga mål satta för {seasonLabel} än.{canEdit && " Klicka “Sätt mål” för att komma igång."}
        </p>
      )}
    </div>
  );
}

type Metric = { label: string; target: number; actual: number; money: boolean; remainLabel: string; variance: boolean; required?: number };

function MetricCard({ label, target, actual, money, remainLabel, variance, required }: Metric) {
  const fmt = (n: number) => (money ? formatSEK(Math.round(n)) : String(Math.round(n)));
  const hasTarget = target > 0;
  const pct = hasTarget ? Math.round((actual / target) * 100) : 0;
  const barPct = Math.min(100, pct);
  const reached = hasTarget && actual >= target;

  let footer: string;
  if (!hasTarget) footer = "Inget mål satt";
  else if (reached) footer = `+${fmt(actual - target)} över mål`;
  else if (variance) footer = `−${fmt(target - actual)} mot mål`;
  else footer = `${fmt(target - actual)} ${remainLabel}`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      <div className="flex items-baseline gap-1.5 mb-2.5">
        <span className="text-xl font-bold text-slate-800">{fmt(actual)}</span>
        {hasTarget && <span className="text-xs text-slate-400">/ {fmt(target)}</span>}
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${reached ? "bg-green-500" : "bg-blue-600"}`} style={{ width: `${barPct}%` }} />
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span className="text-slate-400">{hasTarget ? `${pct}% av mål` : "–"}</span>
        <span className={reached ? "text-green-600 font-medium" : variance ? "text-amber-600" : "text-slate-500"}>{footer}</span>
      </div>
      {required != null && (
        <p className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-400">
          Krävs {fmt(required)}/besök för säljmålet
        </p>
      )}
    </div>
  );
}

function GoalInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function toForm(g: Goal | null) {
  if (!g) return { ...emptyForm };
  return {
    salesTarget: g.salesTarget ? String(g.salesTarget) : "",
    visitsTarget: g.visitsTarget ? String(g.visitsTarget) : "",
    avgPerVisitTarget: g.avgPerVisitTarget ? String(g.avgPerVisitTarget) : "",
    fashionShowsTarget: g.fashionShowsTarget ? String(g.fashionShowsTarget) : "",
  };
}

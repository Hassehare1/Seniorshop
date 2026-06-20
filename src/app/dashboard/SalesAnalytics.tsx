"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { formatSEK } from "@/lib/fees";

// En post i den dimension man bryter ned på (kundtyp ELLER distrikt)
export interface BreakdownItem {
  key: string;       // unik nyckel (typ-enum eller distrikt-id)
  label: string;     // visningsnamn
  color: string;     // hex för diagram
  sales: number;
  ftFee: number;
  mfFee: number;
  customers: number;
  besok: number;
  fashionShows: number;
  weekly: number[];  // försäljning per vecka, i samma ordning som `weeks`
}

interface Props {
  weeks: number[];
  breakdown: BreakdownItem[];
  breakdownTitle: string; // t.ex. "Försäljning per kundtyp"
  filterNoun: string;     // t.ex. "kundtyp" eller "distrikt"
  colorMode?: "category" | "scale"; // fasta kategorifärger eller blå gradient efter rang
}

const BLUE = "#1d4ed8";
const formatK = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);

export default function SalesAnalytics({ weeks, breakdown, breakdownTitle, filterNoun, colorMode = "category" }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const selectedItem = selected ? breakdown.find(b => b.key === selected) ?? null : null;

  // Aggregat för aktuellt urval (vald post, annars alla summerade)
  const agg = useMemo(() => {
    const src = selected ? breakdown.filter(b => b.key === selected) : breakdown;
    const weekly = weeks.map((_, i) => src.reduce((s, b) => s + (b.weekly[i] ?? 0), 0));
    const sum = (f: (b: BreakdownItem) => number) => src.reduce((s, b) => s + f(b), 0);
    return {
      weekly,
      sales: sum(b => b.sales),
      ftFee: sum(b => b.ftFee),
      mfFee: sum(b => b.mfFee),
      customers: sum(b => b.customers),
      besok: sum(b => b.besok),
      fashionShows: sum(b => b.fashionShows),
      reportedWeeks: weekly.filter(v => v > 0).length,
    };
  }, [selected, breakdown, weeks]);

  const weeklyData = useMemo(() => {
    let acc = 0;
    return weeks.map((w, i) => {
      acc += agg.weekly[i];
      return { week: w, sales: agg.weekly[i], accumulated: acc };
    });
  }, [weeks, agg]);

  const chartData = useMemo(
    () => breakdown
      .map(b => ({ key: b.key, label: b.label, color: b.color, sales: b.sales }))
      .sort((a, b) => b.sales - a.sales),
    [breakdown]
  );

  // Färgsättning: "category" = fasta typfärger, "scale" = blå gradient efter rang
  const scaleBlue = ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"];
  const colorAt = (i: number) => {
    if (colorMode === "category") return chartData[i]?.color ?? BLUE;
    const n = chartData.length;
    if (n <= 1) return scaleBlue[1];
    return scaleBlue[Math.round((i / (n - 1)) * (scaleBlue.length - 1))];
  };
  const selectedIdx = selected ? chartData.findIndex(d => d.key === selected) : -1;
  const color = selectedIdx >= 0 ? colorAt(selectedIdx) : BLUE;

  // Anpassad höjd + etikettbredd för nedbrytningspanelen (fler poster → mer plats)
  const breakdownHeight = Math.max(200, chartData.length * 34 + 48);
  const labelWidth = Math.min(150, Math.max(80, Math.max(0, ...chartData.map(d => d.label.length)) * 7));

  const selectedLabel = selectedItem?.label ?? null;
  const tag = selectedLabel ? ` · ${selectedLabel}` : "";

  function toggle(key: string) {
    setSelected(prev => (prev === key ? null : key));
  }

  const tipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" };
  const weekLabel = (v: unknown) => `Vecka ${String(v)}`;
  const fmtAvg = (num: number, den: number) => (den > 0 ? formatSEK(num / den) : "–");

  return (
    <div className="space-y-6">
      <p className="sr-only">
        {selectedLabel ? `Visar ${filterNoun} ${selectedLabel}. ` : `Visar alla. `}
        Total försäljning {formatSEK(agg.sales)} över {agg.reportedWeeks} veckor och {agg.besok} besök.
        Försäljning per {filterNoun}: {chartData.map(d => `${d.label} ${formatSEK(d.sales)}`).join(", ")}.
      </p>
      {selected && (
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-4 py-2.5 text-sm">
          <span>Filter: <strong>{selectedLabel}</strong> — diagram och nyckeltal visar bara denna {filterNoun}</span>
          <button
            onClick={() => setSelected(null)}
            className="ml-auto text-blue-700 hover:text-blue-900 font-medium"
          >
            Visa alla ✕
          </button>
        </div>
      )}

      {/* Ekonomi */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Ekonomi{tag}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Total försäljning" value={formatSEK(agg.sales)} sub="ink. moms" />
          <StatCard label="FT-avgift" value={formatSEK(agg.ftFee)} sub="ex. moms" />
          <StatCard label="MF-avgift" value={formatSEK(agg.mfFee)} sub="ex. moms" />
          <StatCard
            label={selected ? "Veckor med försäljning" : "Rapporterade veckor"}
            value={String(agg.reportedWeeks)}
            sub={`${agg.customers} seniorer besökta`}
          />
        </div>
      </div>

      {/* Snitt & aktivitet */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Snitt &amp; aktivitet{tag}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Snittkvitto" value={fmtAvg(agg.sales, agg.customers)} sub="per kund" />
          <StatCard label="Snitt / besök" value={fmtAvg(agg.sales, agg.besok)} sub="per besök" />
          <StatCard label="Antal besök" value={String(agg.besok)} sub="registrerade besök" />
          <StatCard label="Modevisningar" value={String(agg.fashionShows)} sub="av besöken" />
        </div>
      </div>

      {/* Hjälte: ackumulerad försäljning (full bredd) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Säsongstrend{tag}</h2>
        <p className="text-xs text-slate-400 mb-4">Ackumulerad försäljning</p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={weeklyData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="gradAcc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="week" tickFormatter={(v) => `v${v}`} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tickFormatter={formatK} tick={{ fontSize: 11, fill: "#94a3b8" }} width={40} />
            <Tooltip contentStyle={tipStyle} labelFormatter={weekLabel} formatter={(value) => [formatSEK(Number(value)), "Ackumulerat"]} />
            <Area type="monotone" dataKey="accumulated" stroke={color} strokeWidth={2.5} fill="url(#gradAcc)" dot={false} activeDot={{ r: 4, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Två kompakta paneler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Veckoförsäljning{tag}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="week" tickFormatter={(v) => `v${v}`} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 10, fill: "#94a3b8" }} width={36} />
              <Tooltip contentStyle={tipStyle} labelFormatter={weekLabel} cursor={{ fill: "#f8fafc" }} formatter={(value) => [formatSEK(Number(value)), "Försäljning"]} />
              <Bar dataKey="sales" fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">{breakdownTitle}</h2>
          <p className="text-xs text-slate-400 mb-4">Klicka på en rad för att filtrera</p>
          <ResponsiveContainer width="100%" height={breakdownHeight}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              onClick={(state) => {
                const label = state?.activeLabel;
                const entry = chartData.find(d => d.label === label);
                if (entry) toggle(entry.key);
              }}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="label" width={labelWidth} tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={tipStyle} formatter={(value) => [formatSEK(Number(value)), "Försäljning"]} />
              <Bar dataKey="sales" radius={[0, 3, 3, 0]} maxBarSize={36}>
                {chartData.map((d, i) => (
                  <Cell
                    key={d.key}
                    fill={colorAt(i)}
                    fillOpacity={!selected || selected === d.key ? 1 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl md:text-2xl font-bold text-slate-800 mt-1 truncate">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

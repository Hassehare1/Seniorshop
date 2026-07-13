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
  hangerShows: number;
  weekly: number[];  // försäljning per vecka, i samma ordning som `weeks`
}

interface Props {
  weeks: number[];
  breakdown: BreakdownItem[];
  breakdownTitle: string; // t.ex. "Försäljning per kundtyp"
  filterNoun: string;     // t.ex. "kundtyp" eller "distrikt"
  colorMode?: "category" | "scale"; // fasta kategorifärger eller blå gradient efter rang
  showMf?: boolean;       // admin: visa avgifter (FT + MF). FT ser bara "Att betala".
  hideGoalMetrics?: boolean; // dölj nyckeltal som målkorten redan visar (försäljning, besök, snitt/besök, modevisningar)
}

const BLUE = "#1d4ed8";

// Axelformat på svenska: 1 500 000 → "1,5 mkr", 150 000 → "150 tkr"
const formatAxis = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} mkr`;
  if (v >= 1000) return `${(v / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} tkr`;
  return String(Math.round(v));
};

// Snyggt axelmax (1/2/2,5/5 × 10^n) med jämna ticks — annars ger recharts
// udda steg som "0 / 85k / 170k" direkt ur datamaxet
function niceScale(dataMax: number): { max: number; ticks: number[] } {
  if (dataMax <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = dataMax / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const max = Math.ceil(dataMax / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(t);
  return { max, ticks };
}

// Y-axelbredd anpassad till bredaste tick-etiketten (annars klipps "1,5 mkr")
const axisWidth = (ticks: number[]) =>
  Math.ceil(Math.max(...ticks.map(t => formatAxis(t).length)) * 6.5) + 10;

export default function SalesAnalytics({ weeks, breakdown, breakdownTitle, filterNoun, colorMode = "category", showMf = false, hideGoalMetrics = false }: Props) {
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
      hangerShows: sum(b => b.hangerShows),
      reportedWeeks: weekly.filter(v => v > 0).length,
    };
  }, [selected, breakdown, weeks]);

  const weeklyData = useMemo(() => {
    // Prefix-summa utan muterbar ackumulator (få veckor → ofarligt O(n²))
    return weeks.map((w, i) => ({
      week: w,
      sales: agg.weekly[i],
      accumulated: agg.weekly.slice(0, i + 1).reduce((s, v) => s + v, 0),
    }));
  }, [weeks, agg]);

  const chartData = useMemo(
    () => breakdown
      .map(b => ({ key: b.key, label: b.label, color: b.color, sales: b.sales }))
      .sort((a, b) => b.sales - a.sales),
    [breakdown]
  );

  // Snygga, jämna axelskalor per diagram
  const trendScale = useMemo(() => niceScale(Math.max(0, ...weeklyData.map(d => d.accumulated))), [weeklyData]);
  const weeklyScale = useMemo(() => niceScale(Math.max(0, ...weeklyData.map(d => d.sales))), [weeklyData]);
  const breakdownScale = useMemo(() => niceScale(Math.max(0, ...chartData.map(d => d.sales))), [chartData]);

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

      {hideGoalMetrics ? (
        /* Kompletterande nyckeltal — det målkorten INTE redan visar (utan dubletter) */
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Ekonomi &amp; aktivitet{tag}</p>
          <div className={`grid grid-cols-2 ${showMf ? "md:grid-cols-4 lg:grid-cols-5" : "md:grid-cols-3"} gap-3 md:gap-4`}>
            {showMf && <StatCard label="FT-avgift" value={formatSEK(agg.ftFee)} sub="ex. moms" />}
            {showMf && <StatCard label="MF-avgift" value={formatSEK(agg.mfFee)} sub="ex. moms" />}
            <StatCard label="Snittkvitto" value={fmtAvg(agg.sales, agg.customers)} sub="per kund" />
            <StatCard
              label={selected ? "Veckor med försäljning" : "Rapporterade veckor"}
              value={String(agg.reportedWeeks)}
              sub={`${agg.customers} seniorer besökta`}
            />
            <StatCard label="Galgvisningar" value={String(agg.hangerShows)} sub="av besöken" />
          </div>
        </div>
      ) : (
        <>
          {/* Ekonomi */}
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Ekonomi{tag}</p>
            <div className={`grid grid-cols-2 ${showMf ? "md:grid-cols-4" : "md:grid-cols-2"} gap-3 md:gap-4`}>
              <StatCard label="Total försäljning" value={formatSEK(agg.sales)} sub="ink. moms" />
              {showMf && <StatCard label="FT-avgift" value={formatSEK(agg.ftFee)} sub="ex. moms" />}
              {showMf && <StatCard label="MF-avgift" value={formatSEK(agg.mfFee)} sub="ex. moms" />}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
              <StatCard compact label="Snittkvitto" value={fmtAvg(agg.sales, agg.customers)} sub="per kund" />
              <StatCard compact label="Snitt / besök" value={fmtAvg(agg.sales, agg.besok)} sub="per besök" />
              <StatCard compact label="Antal besök" value={String(agg.besok)} sub="registrerade besök" />
              <StatCard compact label="Modevisningar" value={String(agg.fashionShows)} sub="av besöken" />
              <StatCard compact label="Galgvisningar" value={String(agg.hangerShows)} sub="av besöken" />
            </div>
          </div>
        </>
      )}

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
            <XAxis dataKey="week" tickFormatter={(v) => `v${v}`} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickMargin={6} />
            <YAxis tickFormatter={formatAxis} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, trendScale.max]} ticks={trendScale.ticks} width={axisWidth(trendScale.ticks)} />
            <Tooltip contentStyle={tipStyle} labelFormatter={weekLabel} formatter={(value) => [formatSEK(Number(value)), "Ackumulerat"]} />
            <Area type="monotone" dataKey="accumulated" stroke={color} strokeWidth={2} fill="url(#gradAcc)" dot={false} activeDot={{ r: 4, fill: color }} />
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
              <XAxis dataKey="week" tickFormatter={(v) => `v${v}`} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickMargin={6} />
              <YAxis tickFormatter={formatAxis} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, weeklyScale.max]} ticks={weeklyScale.ticks} width={axisWidth(weeklyScale.ticks)} />
              <Tooltip contentStyle={tipStyle} labelFormatter={weekLabel} cursor={{ fill: "#f8fafc" }} formatter={(value) => [formatSEK(Number(value)), "Försäljning"]} />
              <Bar dataKey="sales" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
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
              <XAxis type="number" tickFormatter={formatAxis} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, breakdownScale.max]} ticks={breakdownScale.ticks} />
              <YAxis type="category" dataKey="label" width={labelWidth} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={tipStyle} formatter={(value) => [formatSEK(Number(value)), "Försäljning"]} />
              <Bar dataKey="sales" radius={[0, 4, 4, 0]} maxBarSize={36}>
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

function StatCard({ label, value, sub, compact }: { label: string; value: string; sub: string; compact?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 ${compact ? "p-3" : "p-4 md:p-5"}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
      <p className={`font-bold text-slate-800 mt-1 truncate ${compact ? "text-lg" : "text-xl md:text-2xl"}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

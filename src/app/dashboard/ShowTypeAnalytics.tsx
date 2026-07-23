"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, Cell, LabelList,
} from "recharts";
import { formatSEK } from "@/lib/fees";

// Aggregat per kundtyp, uppdelat på visningstyp. Klienten summerar de valda
// kundtyperna (union) — en kund har exakt en typ, så inga dubbelräkningar.
export interface ShowTypeItem {
  key: string;    // kundtyp-enum
  label: string;  // visningsnamn för kundtypen
  color: string;  // hex för kundtyps-chippet i filtret
  categories: {
    modevisning: { sales: number; besok: number };
    galge: { sales: number; besok: number };
    ovriga: { sales: number; besok: number };
  };
}

type CatKey = "modevisning" | "galge" | "ovriga";

// Fasta färger per visningstyp — samma i alla tre diagrammen.
const CATS: { key: CatKey; label: string; color: string }[] = [
  { key: "modevisning", label: "Modevisning", color: "#4f46e5" }, // indigo
  { key: "galge", label: "Galge", color: "#0891b2" },            // cyan
  { key: "ovriga", label: "Övriga", color: "#94a3b8" },          // slate
];

interface Props {
  items: ShowTypeItem[];
}

// Kompakt kr-format för stapeletiketter/axel: 1 500 000 → "1,5 mkr", 21 000 → "21 tkr"
const compactSEK = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} mkr`;
  if (v >= 10_000) return `${Math.round(v / 1000).toLocaleString("sv-SE")} tkr`;
  if (v >= 1000) return `${(v / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} tkr`;
  return `${Math.round(v).toLocaleString("sv-SE")} kr`;
};

export default function ShowTypeAnalytics({ items }: Props) {
  // Alla kundtyper valda från start; kryssrutorna filtrerar ner (union).
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map(i => i.key)));

  const allSelected = selected.size === items.length;

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Summera valda kundtyper per visningstyp.
  const agg = useMemo(() => {
    const sel = items.filter(i => selected.has(i.key));
    const cat = (k: CatKey) =>
      sel.reduce(
        (acc, i) => ({ sales: acc.sales + i.categories[k].sales, besok: acc.besok + i.categories[k].besok }),
        { sales: 0, besok: 0 },
      );
    return { modevisning: cat("modevisning"), galge: cat("galge"), ovriga: cat("ovriga") };
  }, [items, selected]);

  const totalSales = agg.modevisning.sales + agg.galge.sales + agg.ovriga.sales;
  const totalBesok = agg.modevisning.besok + agg.galge.besok + agg.ovriga.besok;
  const totalSnitt = totalBesok > 0 ? totalSales / totalBesok : 0;

  // Tre dataset — ett per mått, samma kategoriordning/färg i alla.
  const salesData = CATS.map(c => ({ name: c.label, color: c.color, value: agg[c.key].sales }));
  const besokData = CATS.map(c => ({ name: c.label, color: c.color, value: agg[c.key].besok }));
  const snittData = CATS.map(c => ({
    name: c.label,
    color: c.color,
    value: agg[c.key].besok > 0 ? agg[c.key].sales / agg[c.key].besok : 0,
  }));

  const someSelected = selected.size > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Försäljning per visningstyp</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Modevisning räknas för hela besöket. Modevisning + Galge + Övriga = totalen.
        </p>
      </div>

      <p className="sr-only">
        Total omsättning {formatSEK(totalSales)} över {totalBesok} besök.
        Per visningstyp: {CATS.map(c => `${c.label} ${formatSEK(agg[c.key].sales)} på ${agg[c.key].besok} besök`).join(", ")}.
      </p>

      {/* Kundtypsfilter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 mr-1">Kundtyper:</span>
        {items.map(i => {
          const on = selected.has(i.key);
          return (
            <button
              key={i.key}
              type="button"
              onClick={() => toggle(i.key)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border-slate-300 bg-slate-50 text-slate-700"
                  : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: on ? i.color : "#cbd5e1" }}
              />
              {i.label}
            </button>
          );
        })}
        {!allSelected && (
          <button
            type="button"
            onClick={() => setSelected(new Set(items.map(i => i.key)))}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-1"
          >
            Visa alla
          </button>
        )}
      </div>

      {/* Total som nyckeltalsrad (inte en fjärde stapel) */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Omsättning" value={formatSEK(totalSales)} sub="ink. moms" />
        <StatCard label="Antal besök" value={String(totalBesok)} sub="registrerade" />
        <StatCard label="Snittomsättning" value={formatSEK(totalSnitt)} sub="per besök" />
      </div>

      {someSelected ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MiniChart title="Omsättning" sub="ink. moms" data={salesData} format={compactSEK} tooltipFormat={formatSEK} />
          <MiniChart title="Antal besök" sub="registrerade besök" data={besokData} format={v => String(Math.round(v))} tooltipFormat={v => `${Math.round(v)} st`} />
          <MiniChart title="Snittomsättning" sub="per besök" data={snittData} format={compactSEK} tooltipFormat={formatSEK} />
        </div>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-lg p-8 text-center">
          <p className="text-sm text-slate-400">Välj minst en kundtyp för att se diagrammen.</p>
        </div>
      )}
    </div>
  );
}

function MiniChart({
  title, sub, data, format, tooltipFormat,
}: {
  title: string;
  sub: string;
  data: { name: string; color: string; value: number }[];
  format: (v: number) => string;
  tooltipFormat: (v: number) => string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <p className="text-[11px] text-slate-400 mb-2">{sub}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 4 }} barCategoryGap="20%">
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            interval={0}
          />
          <YAxis hide domain={[0, (max: number) => (max <= 0 ? 1 : max * 1.15)]} />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            formatter={(value) => [tooltipFormat(Number(value)), title]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map(d => (
              <Cell key={d.name} fill={d.color} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v) => format(Number(v))}
              style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
      <p className="font-bold text-slate-800 mt-1 text-lg md:text-xl truncate">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

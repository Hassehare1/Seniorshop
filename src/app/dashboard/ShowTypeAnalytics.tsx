"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, LabelList,
} from "recharts";
import { formatSEK, formatCompactSEK } from "@/lib/fees";
import { MINOR_SALES_TYPE, avgPerVisitExclMinor } from "@/lib/insights/aggregate";

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
type ChartRow = { name: string; total: number; [key: string]: number | string };

const CATS: { key: CatKey; label: string }[] = [
  { key: "modevisning", label: "Modevisning" },
  { key: "galge", label: "Galge" },
  { key: "ovriga", label: "Övriga" },
];

// Totalt-stapelns färg — fast referens, samma i alla diagram.
const TOTAL_COLOR = "#cbd5e1"; // slate-300

interface Props {
  items: ShowTypeItem[];
}

export default function ShowTypeAnalytics({ items }: Props) {
  // Jämförelsekundtyper, i vald ordning — tomt från start. Totalt (alla
  // kundtyper, oavsett markering) visas alltid som fast referensstapel bredvid.
  const [compare, setCompare] = useState<string[]>([]);

  function toggle(key: string) {
    setCompare(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  }

  const byKey = useMemo(() => new Map(items.map(i => [i.key, i])), [items]);
  const selectedItems = useMemo(
    () => compare.map(k => byKey.get(k)).filter((i): i is ShowTypeItem => !!i),
    [compare, byKey],
  );

  // Totalt: summan över ALLA kundtyper, oberoende av vad som är markerat.
  const totals = useMemo(() => {
    const cat = (k: CatKey) =>
      items.reduce(
        (acc, i) => ({ sales: acc.sales + i.categories[k].sales, besok: acc.besok + i.categories[k].besok }),
        { sales: 0, besok: 0 },
      );
    return { modevisning: cat("modevisning"), galge: cat("galge"), ovriga: cat("ovriga") };
  }, [items]);

  const totalSales = totals.modevisning.sales + totals.galge.sales + totals.ovriga.sales;
  const totalBesok = totals.modevisning.besok + totals.galge.besok + totals.ovriga.besok;

  // Nyckeltalet Snittomsättning är samma mått som målkortets "Snitt / besök"
  // och måste därför räknas likadant — mindre försäljning bort. Låg det kvar
  // stod två olika snitt bredvid varandra på samma sida (28 104 mot 29 687 i
  // seeden), båda kallade snitt per besök.
  //
  // Diagrammen nedan rör det inte: där jämförs modevisning mot galge, och
  // "Totalt" är den visningstypens hela summa precis som förut.
  const minor = useMemo(() => {
    const i = items.find(x => x.key === MINOR_SALES_TYPE);
    if (!i) return { sales: 0, besok: 0 };
    const c = i.categories;
    return {
      sales: c.modevisning.sales + c.galge.sales + c.ovriga.sales,
      besok: c.modevisning.besok + c.galge.besok + c.ovriga.besok,
    };
  }, [items]);
  const totalSnitt = avgPerVisitExclMinor(totalSales, totalBesok, minor);

  // Ett dataset per mått: en rad per visningstyp, ett fält per stapel (total +
  // en per vald kundtyp). Recharts ritar en grupperad <Bar> per fält automatiskt.
  const salesData = useMemo<ChartRow[]>(
    () => CATS.map(c => {
      const row: ChartRow = { name: c.label, total: totals[c.key].sales };
      for (const i of selectedItems) row[i.key] = i.categories[c.key].sales;
      return row;
    }),
    [selectedItems, totals],
  );
  const besokData = useMemo<ChartRow[]>(
    () => CATS.map(c => {
      const row: ChartRow = { name: c.label, total: totals[c.key].besok };
      for (const i of selectedItems) row[i.key] = i.categories[c.key].besok;
      return row;
    }),
    [selectedItems, totals],
  );
  const snittData = useMemo<ChartRow[]>(
    () => CATS.map(c => {
      const total = totals[c.key].besok > 0 ? totals[c.key].sales / totals[c.key].besok : 0;
      const row: ChartRow = { name: c.label, total };
      for (const i of selectedItems) {
        const besok = i.categories[c.key].besok;
        row[i.key] = besok > 0 ? i.categories[c.key].sales / besok : 0;
      }
      return row;
    }),
    [selectedItems, totals],
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Försäljning per visningstyp</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Modevisning räknas för hela besöket. Totalt rör sig aldrig — det är visningstypens
          hela summa, oavsett vilka kundtyper som jämförs nedan.
        </p>
      </div>

      <p className="sr-only">
        Total omsättning {formatSEK(totalSales)} över {totalBesok} besök.
        Per visningstyp: {CATS.map(c => `${c.label} ${formatSEK(totals[c.key].sales)} på ${totals[c.key].besok} besök`).join(", ")}.
      </p>

      {/* Jämförelsekundtyper: tomt från start, klick lägger till en egen stapel — ingen övre gräns. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 mr-1">Jämför kundtyper:</span>
        {items.map(i => {
          const idx = compare.indexOf(i.key);
          const on = idx !== -1;
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
              {on ? (
                <span
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-white text-[9px] font-bold"
                  style={{ backgroundColor: i.color }}
                >
                  {idx + 1}
                </span>
              ) : (
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300" />
              )}
              {i.label}
            </button>
          );
        })}
        {compare.length > 0 && (
          <button
            type="button"
            onClick={() => setCompare([])}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-1"
          >
            Rensa
          </button>
        )}
      </div>

      {/* Totalt som nyckeltalsrad — samma tal som referensstapeln, rör sig aldrig. */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Omsättning" value={formatSEK(totalSales)} sub="ink. moms" />
        <StatCard label="Antal besök" value={String(totalBesok)} sub="registrerade" />
        <StatCard label="Snittomsättning" value={formatSEK(totalSnitt)} sub="exkl. mindre förs." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniChart title="Omsättning" sub="ink. moms" data={salesData} series={selectedItems} format={formatCompactSEK} tooltipFormat={formatSEK} />
        <MiniChart title="Antal besök" sub="registrerade besök" data={besokData} series={selectedItems} format={v => String(Math.round(v))} tooltipFormat={v => `${Math.round(v)} st`} />
        <MiniChart title="Snittomsättning" sub="per besök" data={snittData} series={selectedItems} format={formatCompactSEK} tooltipFormat={formatSEK} />
      </div>
    </div>
  );
}

function MiniChart({
  title, sub, data, series, format, tooltipFormat,
}: {
  title: string;
  sub: string;
  data: ChartRow[];
  series: ShowTypeItem[];
  format: (v: number) => string;
  tooltipFormat: (v: number) => string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <p className="text-[11px] text-slate-400 mb-2">{sub}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 4 }} barCategoryGap="20%" barGap={3}>
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
            formatter={(value, name) => [tooltipFormat(Number(value)), name]}
          />
          <Bar dataKey="total" name="Totalt" fill={TOTAL_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40}>
            <LabelList dataKey="total" position="top" formatter={(v) => format(Number(v))} style={{ fontSize: 10, fill: "#475569", fontWeight: 600 }} />
          </Bar>
          {series.map(s => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={40}>
              <LabelList dataKey={s.key} position="top" formatter={(v) => format(Number(v))} style={{ fontSize: 10, fill: "#475569", fontWeight: 600 }} />
            </Bar>
          ))}
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

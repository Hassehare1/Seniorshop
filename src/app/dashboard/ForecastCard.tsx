import { formatSEK } from "@/lib/fees";

export type SeasonStatus = "past" | "current" | "future";

export interface ForecastSeason {
  label: string;          // "Vår 2026"
  status: SeasonStatus;
  note: string;           // förklarar underlaget, t.ex. "pågår · 55 av 71 kunder besökta"
  actual: number;         // utfall (faktiska besök i år)
  forecast: number;       // prognosdel (fjolår på ej besökta kunder)
  total: number;          // actual + forecast
  hasBasis: boolean;      // false = säsongen saknar både utfall och fjolårsunderlag
}

export interface ForecastData {
  year: number;
  total: number;          // helårsprognos
  actualTotal: number;    // summa utfall hittills
  forecastTotal: number;  // summa prognosdel
  prevYearTotal: number;  // fjolårets faktiska helår (0 om saknas)
  seasons: ForecastSeason[];
}

// Helårsprognos: utfall i år + fjolår på ännu ej besökta kunder (per säsong).
// Presentationell — all beräkning sker server-sidan i page.tsx.
export default function ForecastCard({ data }: { data: ForecastData }) {
  const { year, total, actualTotal, forecastTotal, prevYearTotal } = data;

  const hasGrowth = prevYearTotal > 0;
  const growthPct = hasGrowth ? Math.round(((total - prevYearTotal) / prevYearTotal) * 100) : 0;
  const growthUp = growthPct >= 0;

  // Split-bar: andel utfall vs prognos av totalen
  const actualPct = total > 0 ? (actualTotal / total) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
            Helårsprognos {year}
          </p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{formatSEK(total)}</p>
        </div>
        {hasGrowth && (
          <div className="text-right">
            <span
              className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${
                growthUp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {growthUp ? "+" : ""}
              {growthPct} % mot {year - 1}
            </span>
            <p className="text-xs text-slate-400 mt-1.5">
              Helår {year - 1}: {formatSEK(prevYearTotal)}
            </p>
          </div>
        )}
      </div>

      {/* Split-bar utfall vs prognos */}
      {total > 0 && (
        <>
          <div className="mt-5 flex h-3.5 rounded-full overflow-hidden bg-slate-100">
            <div className="bg-blue-600" style={{ width: `${actualPct}%` }} />
            <div className="bg-blue-200" style={{ width: `${100 - actualPct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
              Utfall hittills {formatSEK(actualTotal)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-200" />
              Prognos (fjolår) {formatSEK(forecastTotal)}
            </span>
          </div>
        </>
      )}

      {/* Säsongsrader */}
      <div className="mt-5 border-t border-slate-100 pt-4 space-y-2.5">
        {data.seasons.map(s => (
          <div key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className={s.hasBasis ? "text-slate-700" : "text-slate-400"}>
              {s.label}
              <span className="text-slate-400 text-xs"> · {s.note}</span>
            </span>
            <span
              className={`font-medium tabular-nums ${
                !s.hasBasis
                  ? "text-slate-300"
                  : s.status === "past"
                    ? "text-slate-800"
                    : "text-slate-600"
              }`}
            >
              {formatSEK(s.total)}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400 leading-relaxed">
        Kunder som redan besökts räknas på faktiskt utfall. Kunder som ännu inte besökts
        prognostiseras på samma kunds utfall i motsvarande säsong {year - 1}.
      </p>
    </div>
  );
}

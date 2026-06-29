"use client";

import { useState } from "react";

interface Summary {
  districtNumber: number;
  districtName: string;
  districtExists: boolean;
  seasonLabel: string;
  seasonExists: boolean;
  weekRange: string;
  customers: number;
  visits: number;
  totalSales: number;
  willOverwrite: boolean;
  existingReports: number;
  warnings: string[];
}

interface Result {
  visits: number;
  customers: number;
  replacedWeeks: number;
  districtCreated: boolean;
  seasonCreated: boolean;
}

interface Props {
  districts: { number: number; name: string }[];
}

const fmtSEK = (n: number) => new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";

export default function ImportSlutrapportClient({ districts }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [seasonType, setSeasonType] = useState("VAR");
  const [districtNumber, setDistrictNumber] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Summary | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const existing = districts.find((d) => d.number === Number(districtNumber));

  async function send(confirm: boolean) {
    if (!file) { setError("Välj en Excel-fil först."); return; }
    if (!districtNumber) { setError("Ange distriktsnummer."); return; }
    if (!existing && !districtName.trim()) { setError("Distriktet är nytt — ange ett distriktsnamn."); return; }
    setLoading(true);
    setError("");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("year", String(year));
    fd.set("seasonType", seasonType);
    fd.set("districtNumber", districtNumber);
    fd.set("districtName", existing?.name ?? districtName.trim());
    fd.set("confirm", confirm ? "true" : "false");
    try {
      const res = await fetch("/api/admin/import/slutrapport", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Något gick fel."); setLoading(false); return; }
      if (data.committed) { setResult(data.result as Result); setPreview(null); }
      else { setPreview(data.summary as Summary); }
    } catch {
      setError("Kunde inte nå servern.");
    }
    setLoading(false);
  }

  function resetAll() {
    setResult(null);
    setPreview(null);
    setFile(null);
    setDistrictNumber("");
    setDistrictName("");
  }

  const input = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  // --- Resultat efter bekräftad import ---
  if (result) {
    return (
      <div className="bg-white border border-green-200 rounded-xl p-6 max-w-2xl">
        <p className="text-lg font-semibold text-green-700">Importen är klar ✓</p>
        <ul className="mt-3 text-sm text-slate-600 space-y-1">
          <li>{result.visits} besök importerade · {result.customers} kunder</li>
          {result.replacedWeeks > 0 && <li>Ersatte {result.replacedWeeks} tidigare rapporterade veckor i perioden</li>}
          {result.districtCreated && <li>Nytt distrikt skapades</li>}
          {result.seasonCreated && <li>Ny säsong skapades</li>}
        </ul>
        <button onClick={resetAll} className="mt-5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          Importera en till fil
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">År</label>
            <input type="number" value={year} min={2000} max={2100} onChange={(e) => setYear(Number(e.target.value))} className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Säsong</label>
            <select value={seasonType} onChange={(e) => setSeasonType(e.target.value)} className={input}>
              <option value="VAR">Vår</option>
              <option value="HOST">Höst</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Distriktsnummer</label>
            <input type="number" min={1} value={districtNumber} onChange={(e) => setDistrictNumber(e.target.value)} placeholder="t.ex. 2" className={input} />
            {districtNumber && (
              <p className="text-xs mt-1 text-slate-500">
                {existing ? `Befintligt: ${existing.name}` : "Nytt distrikt — ange namn →"}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Distriktsnamn {existing && <span className="text-slate-400">(befintligt)</span>}</label>
            <input
              type="text"
              value={existing ? existing.name : districtName}
              disabled={!!existing}
              onChange={(e) => setDistrictName(e.target.value)}
              placeholder="t.ex. Distrikt 2 – Skåne"
              className={`${input} disabled:bg-slate-100 disabled:text-slate-500`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Excel-fil (slutrapport)</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        {!preview && (
          <button onClick={() => send(false)} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {loading ? "Granskar…" : "Granska fil"}
          </button>
        )}
      </div>

      {/* Granskning — inget skrivet än */}
      {preview && (
        <div className="bg-white border border-blue-200 rounded-xl p-6 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Granska innan import — inget har sparats än</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="Distrikt" value={`D${preview.districtNumber}`} sub={preview.districtExists ? "befintligt" : "skapas"} />
            <Stat label="Säsong" value={preview.seasonLabel} sub={preview.seasonExists ? "befintlig" : "skapas"} />
            <Stat label="Veckor" value={preview.weekRange} sub="i filen" />
            <Stat label="Kunder" value={String(preview.customers)} sub="" />
            <Stat label="Besök" value={String(preview.visits)} sub="" />
            <Stat label="Försäljning" value={fmtSEK(preview.totalSales)} sub="ink moms" />
          </div>

          {preview.willOverwrite ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              ⚠️ Ersätter {preview.existingReports} tidigare rapporterade vecka(or) för {preview.seasonLabel} i D{preview.districtNumber}. Kunderna behålls.
            </p>
          ) : (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
              ✓ Ny rapportering för {preview.seasonLabel} i D{preview.districtNumber} — inget tidigare rapporterat skrivs över.
            </p>
          )}

          {preview.warnings.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-slate-600 mb-1">{preview.warnings.length} varning(ar):</p>
              <ul className="list-disc pl-5 text-slate-500 space-y-0.5 max-h-40 overflow-y-auto">
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={() => send(true)} disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {loading ? "Importerar…" : "Bekräfta import"}
            </button>
            <button onClick={() => setPreview(null)} disabled={loading} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold text-slate-800 mt-0.5 truncate">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

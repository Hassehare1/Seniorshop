"use client";

import { useState } from "react";
import type { Customer } from "@prisma/client";

interface Props {
  onImported: (created: Customer[]) => void;
}

export default function ImportKunder({ onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ createdCount: number; errors: { row: number; message: string }[] } | null>(null);

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/customers/import", { method: "POST", body: fd });

    if (res.ok) {
      const data = await res.json();
      setResult({ createdCount: data.createdCount, errors: data.errors ?? [] });
      if (data.created?.length) onImported(data.created);
      setFile(null);
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Importen misslyckades." }));
      setError(msg ?? "Importen misslyckades.");
    }
    setBusy(false);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-700">Importera kunder från Excel</h3>
        <p className="text-sm text-slate-500 mt-1">
          Ladda ner mallen, fyll i en kund per rad och ladda upp. Kunderna läggs i ditt distrikt.
        </p>
      </div>

      <a
        href="/api/customers/import/template"
        download
        className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg"
      >
        ↓ Ladda ner Excel-mall
      </a>

      <p className="text-xs text-slate-400">
        Giltiga typer: Träffpunkt, Förening, Vårdhem, Boende +55, Övrigt. Ersätt exempelraden i mallen med dina kunder.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(""); }}
          className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          onClick={handleImport}
          disabled={!file || busy}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {busy ? "Importerar..." : "Importera"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {result && (
        <div className="text-sm">
          <p className="text-green-700 font-medium">✓ {result.createdCount} kunder importerade.</p>
          {result.errors.length > 0 && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-amber-800 font-medium mb-1">{result.errors.length} rader hoppades över:</p>
              <ul className="text-amber-700 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i}>Rad {e.row}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

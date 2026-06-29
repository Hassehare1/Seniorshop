"use client";

import { useState } from "react";

export default function ResetReports() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function reset() {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/import/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Något gick fel.");
      else {
        setMsg(`Tömt: ${data.reports} rapporter och ${data.visits} besök raderade.`);
        setConfirm("");
        setOpen(false);
      }
    } catch {
      setErr("Kunde inte nå servern.");
    }
    setLoading(false);
  }

  return (
    <div className="mt-10 max-w-2xl border border-red-200 rounded-xl p-5 bg-red-50/40">
      <p className="font-semibold text-red-700 text-sm">Nollställ alla siffror</p>
      <p className="text-sm text-slate-600 mt-1">
        Raderar <strong>alla</strong> veckorapporter och besök (alla distrikt och säsonger). Kunder, distrikt och säsonger behålls.
        Kan inte ångras — importera om för att fylla på igen.
      </p>
      {msg && <p className="mt-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{msg}</p>}

      {!open ? (
        <button
          onClick={() => { setOpen(true); setMsg(""); }}
          className="mt-3 text-sm font-medium text-red-700 border border-red-300 hover:bg-red-100 px-4 py-2 rounded-lg"
        >
          Nollställ…
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-sm text-slate-700">Skriv <strong>TÖMMA</strong> för att bekräfta:</label>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="TÖMMA"
            className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={loading || confirm !== "TÖMMA"}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {loading ? "Tömmer…" : "Töm alla siffror"}
            </button>
            <button onClick={() => { setOpen(false); setConfirm(""); setErr(""); }} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

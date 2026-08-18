"use client";

import { useState } from "react";

type Scope = "numbers" | "all";

const LÄGEN: Record<Scope, { ord: string; knapp: string; körKnapp: string }> = {
  numbers: { ord: "TÖMMA", knapp: "Nollställ siffror…", körKnapp: "Töm alla siffror" },
  all: { ord: "RADERA KUNDER", knapp: "Radera allt inför skarp start…", körKnapp: "Radera siffror och kunder" },
};

export default function ResetReports() {
  const [open, setOpen] = useState<Scope | null>(null);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function stäng() {
    setOpen(null);
    setConfirm("");
    setErr("");
  }

  async function reset(scope: Scope) {
    setLoading(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/import/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, scope }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Något gick fel.");
      else {
        setMsg(
          data.customers > 0
            ? `Raderat: ${data.reports} rapporter, ${data.visits} besök och ${data.customers} kunder.`
            : `Tömt: ${data.reports} rapporter och ${data.visits} besök raderade.`,
        );
        stäng();
      }
    } catch {
      setErr("Kunde inte nå servern.");
    }
    setLoading(false);
  }

  const bekräftelse = (scope: Scope) => (
    <div className="mt-3 space-y-2">
      <label className="block text-sm text-slate-700">
        Skriv <strong>{LÄGEN[scope].ord}</strong> för att bekräfta:
      </label>
      <input
        value={confirm}
        onChange={e => setConfirm(e.target.value)}
        placeholder={LÄGEN[scope].ord}
        aria-label={`Bekräfta med ordet ${LÄGEN[scope].ord}`}
        className="w-56 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => reset(scope)}
          disabled={loading || confirm !== LÄGEN[scope].ord}
          className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {loading ? "Raderar…" : LÄGEN[scope].körKnapp}
        </button>
        <button onClick={stäng} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
          Avbryt
        </button>
      </div>
    </div>
  );

  return (
    <div className="mt-10 max-w-2xl space-y-4">
      {msg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">{msg}</p>}

      {/* Den vardagliga: bara siffrorna */}
      <div className="border border-red-200 rounded-xl p-5 bg-red-50/40">
        <p className="font-semibold text-red-700 text-sm">Nollställ alla siffror</p>
        <p className="text-sm text-slate-600 mt-1">
          Raderar <strong>alla</strong> veckorapporter och besök (alla distrikt och säsonger).
          Kunderna behålls med sina kategorier och kontaktuppgifter. Kan inte ångras — importera
          om för att fylla på igen.
        </p>
        {open !== "numbers" ? (
          <button
            onClick={() => { setOpen("numbers"); setConfirm(""); setErr(""); setMsg(""); }}
            className="mt-3 text-sm font-medium text-red-700 border border-red-300 hover:bg-red-100 px-4 py-2 rounded-lg"
          >
            {LÄGEN.numbers.knapp}
          </button>
        ) : bekräftelse("numbers")}
      </div>

      {/* Den hårda: även kundregistret */}
      <div className="border-2 border-red-400 rounded-xl p-5 bg-red-50">
        <p className="font-semibold text-red-800 text-sm">Radera allt inför skarp start</p>
        <p className="text-sm text-slate-700 mt-1">
          Raderar siffrorna <strong>och hela kundregistret</strong> — namn, kategorier,
          kontaktpersoner, telefonnummer och postnummer försvinner. Kunderna skapas på nytt vid
          nästa import, med de kategorier som står i filen.
        </p>
        <p className="text-sm text-slate-700 mt-2">
          Avsedd för <strong>en enda sak</strong>: att gå från testdata till skarp start. Har
          någon franchisetagare fyllt i kontaktuppgifter för hand är de borta. Distrikt, säsonger,
          mål, avgifter och användare rörs inte.
        </p>
        {open !== "all" ? (
          <button
            onClick={() => { setOpen("all"); setConfirm(""); setErr(""); setMsg(""); }}
            className="mt-3 text-sm font-medium text-white bg-red-700 hover:bg-red-800 px-4 py-2 rounded-lg"
          >
            {LÄGEN.all.knapp}
          </button>
        ) : bekräftelse("all")}
      </div>
    </div>
  );
}

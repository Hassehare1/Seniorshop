"use client";

import { useState } from "react";

const EXEMPEL = [
  "Hur gick försäljningen i D6 förra våren?",
  "Vilken kundtyp säljer bäst?",
  "Hur ligger D6 mot sina mål?",
];

export default function AssistentClient() {
  const [fraga, setFraga] = useState("");
  const [svar, setSvar] = useState("");
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(false);

  async function skicka(text: string) {
    const q = text.trim();
    if (!q || laddar) return;

    setLaddar(true);
    setFel("");
    setSvar("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fraga: q }),
      });
      const data = await res.json();
      if (res.ok) setSvar(data.svar);
      else if (res.status === 401) setFel("Du är utloggad — ladda om sidan och logga in igen.");
      else if (res.status === 403) setFel("Assistenten är bara öppen för admin.");
      else setFel(data.error ?? "Något gick fel.");
    } catch {
      setFel("Kunde inte nå servern.");
    } finally {
      setLaddar(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <form
        onSubmit={e => {
          e.preventDefault();
          void skicka(fraga);
        }}
      >
        <textarea
          value={fraga}
          onChange={e => setFraga(e.target.value)}
          onKeyDown={e => {
            // Enter skickar, Skift+Enter ger ny rad
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void skicka(fraga);
            }
          }}
          rows={3}
          placeholder="Fråga något om försäljningen…"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={laddar || fraga.trim() === ""}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {laddar ? "Tänker…" : "Fråga"}
          </button>
          <span className="text-xs text-slate-400">Svaren kan ta en stund.</span>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXEMPEL.map(e => (
          <button
            key={e}
            type="button"
            onClick={() => {
              setFraga(e);
              void skicka(e);
            }}
            disabled={laddar}
            className="text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 px-3 py-1.5 rounded-full transition-colors"
          >
            {e}
          </button>
        ))}
      </div>

      {fel && (
        <p className="mt-5 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
          {fel}
        </p>
      )}

      {svar && (
        <div className="mt-5 bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">
            Svar
          </p>
          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{svar}</p>
        </div>
      )}
    </div>
  );
}

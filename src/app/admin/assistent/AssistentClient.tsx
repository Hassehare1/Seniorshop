"use client";

import { useState } from "react";

const EXEMPEL = [
  "Hur gick försäljningen i D6 förra våren?",
  "Vilken kundtyp säljer bäst?",
  "Hur ligger D6 mot sina mål?",
  "Vilket distrikt går bäst?",
];

const VERKTYGSNAMN: Record<string, string> = {
  lista_sasonger: "säsonger",
  forsaljning_per_kundtyp: "försäljning per kundtyp",
  mal_mot_utfall: "mål mot utfall",
  jamfor_distrikt: "jämförelse mellan distrikt",
};

type Uppslag = { verktyg: string; urval?: string; sasong?: string };
type Tur = { fraga: string; svar: string; uppslag: Uppslag[] };

/**
 * Vad servern slog upp, under svaret. Värdena kommer ur verktygens resultat,
 * så en felvald säsong eller ett felvalt distrikt syns här även om modellens
 * text låter övertygande.
 */
function Uppslagsrad({ uppslag }: { uppslag: Uppslag[] }) {
  if (uppslag.length === 0) return null;

  const unika = (v: (u: Uppslag) => string | undefined) =>
    [...new Set(uppslag.map(v).filter((x): x is string => !!x))];

  const delar = [
    ...unika(u => u.sasong),
    ...unika(u => u.urval),
    ...unika(u => VERKTYGSNAMN[u.verktyg] ?? u.verktyg),
  ];

  return (
    <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400">
      Hämtat: {delar.join(" · ")}
    </p>
  );
}

export default function AssistentClient() {
  const [fraga, setFraga] = useState("");
  const [historik, setHistorik] = useState<Tur[]>([]);
  const [fel, setFel] = useState("");
  const [laddar, setLaddar] = useState(false);

  async function skicka(text: string) {
    const q = text.trim();
    if (!q || laddar) return;

    setLaddar(true);
    setFel("");
    setFraga("");
    try {
      // Historiken följer med så att följdfrågor som "och D7 då?" fungerar.
      const meddelanden = [
        ...historik.flatMap(t => [
          { role: "user" as const, content: t.fraga },
          { role: "assistant" as const, content: t.svar },
        ]),
        { role: "user" as const, content: q },
      ];
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meddelanden }),
      });
      const data = await res.json();
      if (res.ok) {
        setHistorik(h => [...h, { fraga: q, svar: data.svar, uppslag: data.uppslag ?? [] }]);
      } else {
        setFraga(q); // låt frågan stå kvar så den går att skicka om
        if (res.status === 401) setFel("Du är utloggad — ladda om sidan och logga in igen.");
        else if (res.status === 403) setFel("Assistenten är bara öppen för admin.");
        else setFel(data.error ?? "Något gick fel.");
      }
    } catch {
      setFraga(q);
      setFel("Kunde inte nå servern.");
    } finally {
      setLaddar(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {historik.length > 0 && (
        <div className="mb-5 space-y-4">
          {historik.map((t, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-slate-500 mb-2">{t.fraga}</p>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{t.svar}</p>
                <Uppslagsrad uppslag={t.uppslag} />
              </div>
            </div>
          ))}
        </div>
      )}

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
          placeholder={
            historik.length > 0 ? "Ställ en följdfråga…" : "Fråga något om försäljningen…"
          }
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
          {historik.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setHistorik([]);
                setFel("");
              }}
              disabled={laddar}
              className="text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Börja om
            </button>
          ) : (
            <span className="text-xs text-slate-400">Svaren kan ta en stund.</span>
          )}
        </div>
      </form>

      {historik.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXEMPEL.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => void skicka(e)}
              disabled={laddar}
              className="text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 px-3 py-1.5 rounded-full transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {fel && (
        <p className="mt-5 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
          {fel}
        </p>
      )}
    </div>
  );
}

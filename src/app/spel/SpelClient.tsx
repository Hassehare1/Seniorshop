"use client";

import { useState } from "react";
import { BINGO_LINES, HITS_TO_WIN } from "@/lib/bingo";

type Phase = "start" | "playing" | "won";
type Game = { deck: string[]; index: number; hits: string[] };

// Spelets egen accentfärg. Medvetet inte portalens blå — det här är en annan
// sak än rapportering, och ska kännas som det.
const DABBER = "#D6006E";

function shuffle(items: readonly string[]): string[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newGame(): Game {
  return { deck: shuffle(BINGO_LINES), index: 0, hits: [] };
}

// Nästa replik. När leken tar slut blandas den om — utan att repliken man
// precis såg dyker upp direkt igen.
function advance(game: Game): Game {
  const next = game.index + 1;
  if (next < game.deck.length) return { ...game, index: next };

  const deck = shuffle(BINGO_LINES);
  if (deck.length > 1 && deck[0] === game.deck[game.index]) {
    [deck[0], deck[1]] = [deck[1], deck[0]];
  }
  return { ...game, deck, index: 0 };
}

// Kort fanfar vid bingo. Byggd med WebAudio så den inte kräver någon ljudfil.
function playFanfare() {
  try {
    const w = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
    setTimeout(() => void ctx.close(), 1400);
  } catch {
    // Ljudet är en bonus — spelet fungerar lika bra utan.
  }
}

export default function SpelClient() {
  const [phase, setPhase] = useState<Phase>("start");
  const [game, setGame] = useState<Game>(newGame);
  const [sound, setSound] = useState(true);

  const current = game.deck[game.index];

  function start() {
    setGame(newGame());
    setPhase("playing");
  }

  function handleHit() {
    const hits = [...game.hits, current];
    if (hits.length >= HITS_TO_WIN) {
      setGame({ ...game, hits });
      setPhase("won");
      if (sound) playFanfare();
      return;
    }
    setGame({ ...advance(game), hits });
  }

  function handleSkip() {
    setGame(advance(game));
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setSound(s => !s)}
          aria-pressed={sound}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Ljud: {sound ? "på" : "av"}
        </button>
      </div>

      {phase === "start" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            SeniorShop
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-800">
            Modevisningsbingo
          </h2>
          <p className="mx-auto mt-4 max-w-[28ch] text-lg leading-relaxed text-slate-600">
            Lyssna på vad som sägs i rummet. Tryck när du hör repliken. Fem stycken, så har du
            bingo.
          </p>
          <button
            type="button"
            onClick={start}
            style={{ backgroundColor: DABBER }}
            className="mt-8 min-h-20 w-full rounded-2xl text-2xl font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-blue-600"
          >
            Börja spela
          </button>
        </div>
      )}

      {phase === "playing" && (
        <div className="space-y-4">
          <div className="flex justify-center gap-2" aria-label={`${game.hits.length} av ${HITS_TO_WIN} stämplade`}>
            {Array.from({ length: HITS_TO_WIN }, (_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="h-4 w-4 rounded-full border-2 transition-colors"
                style={
                  i < game.hits.length
                    ? { backgroundColor: DABBER, borderColor: DABBER }
                    : { borderColor: "#cbd5e1" }
                }
              />
            ))}
          </div>

          <div
            key={`${game.index}-${current}`}
            className="bingo-card-in flex min-h-52 flex-col justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-5 py-10 text-center shadow-sm"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Hör du någon säga
            </span>
            <p aria-live="polite" className="text-4xl font-bold leading-[1.1] tracking-tight text-slate-900">
              {current}
            </p>
          </div>

          <button
            type="button"
            onClick={handleHit}
            style={{ backgroundColor: DABBER }}
            className="min-h-24 w-full rounded-2xl text-2xl font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-blue-600"
          >
            Det hände!
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="min-h-14 w-full rounded-2xl border-2 border-slate-200 text-lg font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-blue-600"
          >
            Nästa replik
          </button>
        </div>
      )}

      {phase === "won" && (
        <div
          style={{ backgroundColor: DABBER }}
          className="rounded-2xl p-8 text-center text-white shadow-sm"
        >
          <p className="text-6xl font-extrabold tracking-tight">Bingo!</p>
          <p className="mx-auto mt-3 max-w-[24ch] text-lg text-white/90">
            Fem stycken. Du lyssnade bättre än de flesta.
          </p>

          <ul className="mt-7 space-y-2 text-left">
            {game.hits.map((line, i) => (
              <li
                key={`${i}-${line}`}
                className="rounded-xl bg-white/15 px-4 py-3 text-base font-semibold leading-snug"
              >
                {line}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={start}
            className="mt-7 min-h-16 w-full rounded-2xl border-[3px] border-white text-xl font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white"
          >
            Spela igen
          </button>
        </div>
      )}
    </div>
  );
}

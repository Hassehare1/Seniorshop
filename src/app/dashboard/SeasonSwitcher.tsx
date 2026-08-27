"use client";

import { useRouter } from "next/navigation";
import { getCurrentWeekAndYear } from "@/lib/week";
import type { SeasonRow } from "@/lib/season";

type SeasonInfo = SeasonRow & { weekStart: number; weekEnd: number };

interface Props {
  seasons: SeasonInfo[];
  currentValue: string; // säsongs-id, eller "helar:<år>"
  districtId?: string | null;
}

type Kind = "VAR" | "HOST" | "HELAR";
type YearEntry = { var?: SeasonInfo; host?: SeasonInfo };

const COOKIE_NAME = "seniorshop_season";

function groupByYear(seasons: SeasonInfo[]): Map<number, YearEntry> {
  const years = new Map<number, YearEntry>();
  for (const s of seasons) {
    const entry = years.get(s.year) ?? {};
    if (s.type === "VAR") entry.var = s; else entry.host = s;
    years.set(s.year, entry);
  }
  return years;
}

function valueFor(entry: YearEntry | undefined, year: number, kind: Kind): string | null {
  if (!entry) return null;
  if (kind === "HELAR") return entry.var && entry.host ? `helar:${year}` : null;
  if (kind === "VAR") return entry.var?.id ?? null;
  return entry.host?.id ?? null;
}

/**
 * Årsflikar + Vår/Höst/Helår-segment i stället för en gömd webbläsarrullista.
 * Året väljs för sig; segmentet håller sig till max tre knappar oavsett hur
 * många år som samlas på över tid — bytt från <select> efter Johans önskemål
 * 2026-08-27 (mockup "A3 · Flikrad" godkänd). Se [[sasongsvaljare-a3-design]].
 */
export default function SeasonSwitcher({ seasons, currentValue, districtId }: Props) {
  const router = useRouter();
  const byYear = groupByYear(seasons);
  const years = [...byYear.keys()].sort((a, b) => a - b);

  const helarMatch = currentValue.startsWith("helar:") ? Number(currentValue.slice(6)) : null;
  const seasonMatch = seasons.find(s => s.id === currentValue);
  const currentYear = helarMatch ?? seasonMatch?.year ?? years[years.length - 1];
  const currentKind: Kind = helarMatch != null ? "HELAR" : seasonMatch?.type ?? "HELAR";

  const { week: nowWeek, year: nowYear } = getCurrentWeekAndYear();
  const isOngoing = (s: SeasonInfo) => s.year === nowYear && s.weekStart <= nowWeek && s.weekEnd >= nowWeek;

  function navigate(value: string) {
    // Kom ihåg valet till nästa besök — bara på den här enheten, ingen server inblandad.
    //
    // Verifierat falsklarm (2026-08-27): react-hooks/immutability (React
    // Compiler, fortfarande experimentell) flaggar raden nedan felaktigt när
    // komponenten längre ner läser flera fält av samma Map-hämtade objekt
    // (entry.var/entry.host) inuti en .map()-renderare — även med rena
    // if/else-satser utan optional chaining. document.cookie sätts i en
    // klickhanterare, inte under render; ingen React-hanterad state rörs.
    // Testat >10 semantiskt identiska varianter, felet flyttar sig men
    // försvinner aldrig så länge båda mönstren finns kvar i komponenten. Ta
    // bort disable-raden och kör `npm run lint` om regeln uppdateras.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=31536000; SameSite=Lax`;
    const params = new URLSearchParams({ season: value });
    if (districtId) params.set("district", districtId);
    router.push(`/dashboard?${params.toString()}`);
  }

  function selectYear(year: number) {
    // Håll kvar samma typ (Vår/Höst/Helår) vid årsbyte om den finns kvar,
    // annars Helår, annars vad som helst som finns — hellre en gissning än
    // ett dött klick.
    const entry = byYear.get(year);
    const kinds: Kind[] = [currentKind, "HELAR", "VAR", "HOST"];
    const value = kinds.map(k => valueFor(entry, year, k)).find((v): v is string => v != null);
    if (value) navigate(value);
  }

  const currentEntry = byYear.get(currentYear);
  const segmentOptions = [
    currentEntry?.var && { kind: "VAR" as const, label: "Vår", value: currentEntry.var.id, live: isOngoing(currentEntry.var) },
    currentEntry?.host && { kind: "HOST" as const, label: "Höst", value: currentEntry.host.id, live: isOngoing(currentEntry.host) },
    currentEntry?.var && currentEntry?.host && { kind: "HELAR" as const, label: "Helår", value: `helar:${currentYear}`, live: false },
  ].filter((o): o is { kind: Kind; label: string; value: string; live: boolean } => !!o);

  return (
    <div>
      <div className="flex gap-5 border-b border-slate-200" role="group" aria-label="Välj år">
        {years.map(year => {
          const entry = byYear.get(year);
          const hasLive = (entry?.var != null && isOngoing(entry.var)) || (entry?.host != null && isOngoing(entry.host));
          const active = year === currentYear;
          return (
            <button
              key={year}
              type="button"
              aria-pressed={active}
              onClick={() => selectYear(year)}
              className={`relative pb-2.5 text-sm font-semibold transition-colors ${
                active ? "text-slate-800" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {year}
              {hasLive && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-500 align-middle" />}
              {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-blue-600 rounded-t-full" />}
            </button>
          );
        })}
      </div>
      {segmentOptions.length > 0 && (
        <div
          className="mt-3 inline-flex p-0.5 gap-0.5 bg-slate-100 border border-slate-200 rounded-lg"
          role="group"
          aria-label="Välj Vår, Höst eller Helår"
        >
          {segmentOptions.map(o => (
            <button
              key={o.kind}
              type="button"
              aria-pressed={o.value === currentValue}
              onClick={() => navigate(o.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                o.value === currentValue ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {o.live && (
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${
                    o.value === currentValue ? "bg-white" : "bg-green-500"
                  }`}
                />
              )}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

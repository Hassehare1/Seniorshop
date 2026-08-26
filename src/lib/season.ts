export type SeasonLike = {
  id: string;
  year: number;
  weekStart: number;
  weekEnd: number;
};

export type SeasonTypeLike = "VAR" | "HOST";
export type SeasonRow = { id: string; type: SeasonTypeLike; year: number };

/**
 * Vad Översikten visar just nu: antingen en riktig säsong, eller ett "helår"
 * — Vår och Höst av samma år slagna ihop. Helår är inget som lagras i
 * databasen; det byggs av de säsonger som redan finns för det året.
 *
 * seasonIds finns på båda varianterna så att anroparen kan hämta data på ett
 * enda sätt (`{ seasonId: { in: period.seasonIds } }`) utan att grena på kind.
 */
export type OverviewPeriod =
  | { kind: "season"; id: string; type: SeasonTypeLike; year: number; label: string; seasonIds: string[] }
  | { kind: "helar"; year: number; label: string; seasonIds: string[] };

const HELAR_PREFIX = "helar:";

function toSeasonPeriod(s: SeasonRow): OverviewPeriod {
  return {
    kind: "season",
    id: s.id,
    type: s.type,
    year: s.year,
    label: `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}`,
    seasonIds: [s.id],
  };
}

function tryResolvePeriod(seasons: SeasonRow[], param: string): OverviewPeriod | null {
  if (param.startsWith(HELAR_PREFIX)) {
    const year = Number(param.slice(HELAR_PREFIX.length));
    const matches = seasons.filter(s => s.year === year);
    return matches.length > 0 ? { kind: "helar", year, label: `Helår ${year}`, seasonIds: matches.map(s => s.id) } : null;
  }
  const found = seasons.find(s => s.id === param);
  return found ? toSeasonPeriod(found) : null;
}

/**
 * Vilken period Översikten ska visa. `seasons` måste redan vara sorterad
 * nyast → äldst (samma ordning som overallt annars i portalen,
 * `orderBy: [{ year: "desc" }, { type: "desc" }]`) — sista utvägen är
 * `seasons[0]`.
 *
 * En uttrycklig period från URL:en väger tyngst (delad länk, bakåt-knapp).
 * Därefter det ihågkomna valet (kakan väljaren satte senast). En ogiltig
 * eller okänd sträng i endera faller igenom i stället för att krascha —
 * samma "peka på nyaste i stället" som resolveReportSeason.
 */
export function resolveOverviewPeriod(
  seasons: SeasonRow[],
  urlParam?: string | null,
  rememberedParam?: string | null,
): OverviewPeriod | null {
  return (
    (urlParam ? tryResolvePeriod(seasons, urlParam) : null) ??
    (rememberedParam ? tryResolvePeriod(seasons, rememberedParam) : null) ??
    (seasons.length > 0 ? toSeasonPeriod(seasons[0]) : null)
  );
}

/**
 * Vilken säsong rapporteringen ska skriva till.
 *
 * Säsonger läggs in för hand av admin. Tidigare föll sidan tillbaka på den
 * senaste säsongen när dagens vecka inte rymdes i någon — glömdes en vår eller
 * höst bort hamnade rapporterna alltså tyst i föregående säsong, utan varning.
 * Nu returneras null i stället, så sidan kan säga ifrån.
 *
 * En uttrycklig säsong från URL:en (länk från översikten) väger tyngre än
 * dagens datum. Annars gick en gammal vecka inte att redigera i glappet mellan
 * två säsonger.
 */
export function resolveReportSeason<T extends SeasonLike>(
  seasons: T[],
  currentWeek: number,
  currentYear: number,
  seasonParam?: string,
): T | null {
  const requested = seasonParam ? seasons.find(s => s.id === seasonParam) : undefined;
  if (requested) return requested;

  return (
    seasons.find(
      s => s.year === currentYear && s.weekStart <= currentWeek && s.weekEnd >= currentWeek,
    ) ?? null
  );
}

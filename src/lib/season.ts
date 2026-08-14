export type SeasonLike = {
  id: string;
  year: number;
  weekStart: number;
  weekEnd: number;
};

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

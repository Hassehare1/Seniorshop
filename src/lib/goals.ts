export type Goal = {
  salesTarget: number;
  visitsTarget: number;
  avgPerVisitTarget: number;
  fashionShowsTarget: number;
};

export type Actuals = {
  sales: number;
  visits: number;
  avgPerVisit: number;
  fashionShows: number;
};

/** Läget för säljmålet, i förhållande till vad som återstår av säsongen. */
export type SalesPace =
  /** Inga mål satta att räkna på */
  | { kind: "none" }
  /** Säljmålet redan passerat */
  | { kind: "reached" }
  /** Besöksmålet passerat men försäljningen ligger efter */
  | { kind: "visitsExhausted"; salesLeft: number }
  /** Så mycket per besök som återstår för att nå säljmålet */
  | { kind: "perVisit"; perVisit: number; visitsLeft: number };

/**
 * Vad som behöver säljas per ÅTERSTÅENDE besök för att nå säljmålet.
 *
 * Tidigare visade översikten säljmål ÷ besöksmål — ett statiskt förhållande
 * mellan två mål som aldrig ändrades. Det påstod att något "krävdes" även när
 * målet redan var passerat (1 000 000 / 85 = 11 765 kr/besök visades trots att
 * försäljningen låg 71 308 kr över mål), och svarade aldrig på frågan man
 * faktiskt ställer sig mitt i säsongen. Räkningen utgår därför från det som
 * är kvar.
 *
 * Returnerar rena tal — formateringen hör hemma i komponenten.
 */
export function salesPace(goal: Goal | null, actuals: Actuals): SalesPace {
  if (!goal || goal.salesTarget <= 0 || goal.visitsTarget <= 0) return { kind: "none" };

  const salesLeft = goal.salesTarget - actuals.sales;
  if (salesLeft <= 0) return { kind: "reached" };

  const visitsLeft = goal.visitsTarget - actuals.visits;
  // Fler besök än målet redan gjorda — då finns inget "per återstående besök"
  // att räkna på, men gapet är fortfarande värt att visa.
  if (visitsLeft <= 0) return { kind: "visitsExhausted", salesLeft };

  return { kind: "perVisit", perVisit: salesLeft / visitsLeft, visitsLeft };
}

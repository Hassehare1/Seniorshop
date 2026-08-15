/** Ett distrikts utfall för en säsong, som det kommer ur aggregeringen. */
export type DistrictRow = {
  id: string;
  label: string;
  sales: number;
  besok: number;
  customers: number;
  fashionShows: number;
};

/** Säljmålet för ett distrikt. Distrikt utan mål saknas i listan. */
export type DistrictGoal = { districtId: string; salesTarget: number };

export type RankedDistrict = {
  label: string;
  sales: number;
  besok: number;
  customers: number;
  avgPerVisit: number;
  fashionShows: number;
  /** Null när distriktet saknar mål för säsongen. */
  salesTarget: number | null;
  /** Andel av säljmålet i procent. Null när målet saknas eller är noll. */
  goalPercent: number | null;
};

/**
 * Distrikten rangordnade.
 *
 * Rankas på andel av säljmålet, inte på kronor. Distrikten är olika stora och
 * har olika många kunder, så en ren kronrankning säger mest vilket distrikt som
 * är störst — sällan vilket som går bäst.
 *
 * Distrikt utan mål hamnar sist och rangordnas inbördes på försäljning. Har
 * inget distrikt mål blir hela listan alltså kronrankad, vilket är det bästa
 * som går att göra då.
 *
 * Distrikt som inte rapporterat något ska skickas in med nollor, inte
 * utelämnas — ett tyst distrikt är ett svar i sig och får inte försvinna.
 */
export function rankDistricts(rows: DistrictRow[], goals: DistrictGoal[]): RankedDistrict[] {
  const målPerDistrikt = new Map(goals.map(g => [g.districtId, g.salesTarget]));

  return rows
    .map(r => {
      const mål = målPerDistrikt.get(r.id) ?? null;
      return {
        label: r.label,
        sales: r.sales,
        besok: r.besok,
        customers: r.customers,
        avgPerVisit: r.besok > 0 ? r.sales / r.besok : 0,
        fashionShows: r.fashionShows,
        salesTarget: mål,
        goalPercent: mål != null && mål > 0 ? (r.sales / mål) * 100 : null,
      };
    })
    .sort(
      (a, b) =>
        (b.goalPercent ?? -1) - (a.goalPercent ?? -1) ||
        b.sales - a.sales ||
        a.label.localeCompare(b.label, "sv"),
    );
}

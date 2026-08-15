export type SeasonWindow = { year: number; weekStart: number; weekEnd: number };

/** Veckospannet som ska räknas med, inklusive båda ändarna. */
export type WeekRange = { from: number; to: number };

export type YearOverYear = {
  /** Hur många veckor in i säsongen jämförelsen sträcker sig. */
  veckor: number;
  /** True när säsongen inte är slut, dvs. jämförelsen är avkortad. */
  pagaende: boolean;
  /** Null när säsongen ännu inte börjat — då finns inget att jämföra. */
  innevarande: WeekRange | null;
  fjolaret: WeekRange | null;
};

const längd = (s: SeasonWindow) => s.weekEnd - s.weekStart + 1;

/**
 * Hur många veckor av säsongen som passerat.
 *
 * En säsong från ett tidigare år är alltid färdig; en från ett kommande år har
 * inte börjat. Under innevarande år avgör veckan.
 */
export function elapsedWeeks(season: SeasonWindow, today: { week: number; year: number }): number {
  if (today.year > season.year) return längd(season);
  if (today.year < season.year) return 0;
  if (today.week < season.weekStart) return 0;
  if (today.week > season.weekEnd) return längd(season);
  return today.week - season.weekStart + 1;
}

/**
 * Vilka veckor som får jämföras mellan två säsonger.
 *
 * Det här är hela poängen med år-mot-år. Höst 2026 pågår; jämförs den rakt av
 * mot en avslutad Höst 2025 ser det alltid ut som ras, eftersom halva säsongen
 * saknas. Båda sidor klipps därför vid lika många veckor räknat från sin egen
 * säsongsstart — inte vid samma veckonummer, eftersom säsongernas veckospann
 * kan skilja sig mellan åren.
 *
 * Är fjolårssäsongen kortare klipps båda vid den kortare längden, så att
 * jämförelsen förblir lika lång på båda sidor.
 */
export function comparableWeeks(
  innevarande: SeasonWindow,
  fjolaret: SeasonWindow,
  today: { week: number; year: number },
): YearOverYear {
  const gångna = elapsedWeeks(innevarande, today);
  const veckor = Math.min(gångna, längd(innevarande), längd(fjolaret));

  if (veckor <= 0) {
    return { veckor: 0, pagaende: gångna < längd(innevarande), innevarande: null, fjolaret: null };
  }

  return {
    veckor,
    pagaende: gångna < längd(innevarande),
    innevarande: { from: innevarande.weekStart, to: innevarande.weekStart + veckor - 1 },
    fjolaret: { from: fjolaret.weekStart, to: fjolaret.weekStart + veckor - 1 },
  };
}

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

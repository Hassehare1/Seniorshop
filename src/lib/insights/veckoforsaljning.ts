// Försäljningen vecka för vecka.
//
// Aggregeringen i aggregate.ts summerar per säsong; veckoserien finns där bara
// som kronor per vecka (TypeAgg.weekly) och skickas aldrig vidare. Assistenten
// hade därför ingen upplösning under en hel säsong, och frågor som "vilket
// distrikt har bäst veckoförsäljning" eller "hur gick vecka 36" gick inte att
// besvara.
//
// Summorna är TOTALER, mindre försäljning inräknad — det är omsättningen som
// rapporteras och faktureras. Bara snittet per besök tvättas, och det hör inte
// hemma här. Se MINOR_SALES_TYPE i customerTypes.ts.
//
// Prisma-fritt, som resten av insights/.

export type VeckoBesok = { sales: number };

export type VeckoRapport = {
  week: number;
  districtId: string;
  visits: VeckoBesok[];
};

export type VeckoDistrikt = { id: string; number: number; name: string };

/** En vecka, summerad över hela urvalet. */
export type VeckoTotal = {
  vecka: number;
  forsaljning: number;
  besok: number;
};

/** Ett distrikts veckomönster, utan att skicka hela matrisen. */
export type VeckoDistriktRad = {
  districtId: string;
  number: number;
  label: string;
  total: number;
  /** Antal veckor distriktet faktiskt rapporterat något på. */
  rapporteradeVeckor: number;
  /** Snitt per rapporterad vecka — inte per kalendervecka i säsongen. */
  snittPerVecka: number;
  /** Distriktets bästa vecka. Null när ingenting rapporterats. */
  bastaVecka: { vecka: number; forsaljning: number } | null;
};

const summa = (v: VeckoBesok[]) => v.reduce((s, b) => s + b.sales, 0);

/**
 * En rad per vecka, summerad över urvalet och sorterad på veckonummer.
 *
 * Bara veckor som faktiskt har en rapport tas med. Att fylla ut säsongens alla
 * veckor med nollor gör listan dubbelt så lång utan att svara på något — en
 * vecka utan rapport och en vecka med noll kronor är olika saker, och den
 * skillnaden går förlorad om båda skrivs som 0.
 */
export function forsaljningPerVecka(rapporter: VeckoRapport[]): VeckoTotal[] {
  const perVecka = new Map<number, VeckoTotal>();

  for (const r of rapporter) {
    const rad = perVecka.get(r.week) ?? { vecka: r.week, forsaljning: 0, besok: 0 };
    rad.forsaljning += summa(r.visits);
    rad.besok += r.visits.length;
    perVecka.set(r.week, rad);
  }

  return [...perVecka.values()].sort((a, b) => a.vecka - b.vecka);
}

/**
 * Ett distrikts vecka: sammanfattat, inte hela matrisen.
 *
 * Med tjugo veckor och trettio distrikt blir den fullständiga tabellen
 * sexhundra rader. Modellen behöver inte se dem för att svara på vem som har
 * bäst vecka — den behöver totalen, bästa veckan och snittet.
 *
 * Distrikt utan rapporter tas med som nollrader: ett tyst distrikt är ett svar.
 */
export function veckoPerDistrikt(
  rapporter: VeckoRapport[],
  distrikt: VeckoDistrikt[],
): VeckoDistriktRad[] {
  const rader = new Map<string, VeckoDistriktRad>(
    distrikt.map(d => [d.id, {
      districtId: d.id,
      number: d.number,
      label: `D${d.number} – ${d.name}`,
      total: 0,
      rapporteradeVeckor: 0,
      snittPerVecka: 0,
      bastaVecka: null,
    }]),
  );
  // Samma distrikt kan ha flera rapporter samma vecka i teorin; slå ihop dem
  // innan bästa veckan avgörs, annars jämförs delsummor.
  const perDistriktVecka = new Map<string, Map<number, number>>();

  for (const r of rapporter) {
    if (!rader.has(r.districtId)) continue; // distrikt utanför urvalet
    const veckor = perDistriktVecka.get(r.districtId) ?? new Map<number, number>();
    veckor.set(r.week, (veckor.get(r.week) ?? 0) + summa(r.visits));
    perDistriktVecka.set(r.districtId, veckor);
  }

  for (const [id, veckor] of perDistriktVecka) {
    const rad = rader.get(id)!;
    for (const [vecka, forsaljning] of veckor) {
      rad.total += forsaljning;
      rad.rapporteradeVeckor += 1;
      if (!rad.bastaVecka || forsaljning > rad.bastaVecka.forsaljning) {
        rad.bastaVecka = { vecka, forsaljning };
      }
    }
    rad.snittPerVecka = rad.rapporteradeVeckor > 0 ? rad.total / rad.rapporteradeVeckor : 0;
  }

  return [...rader.values()].sort((a, b) => a.number - b.number);
}

/** Urvalet begränsat till en enda vecka. Tomt när veckan saknar rapporter. */
export function bara(rapporter: VeckoRapport[], vecka: number): VeckoRapport[] {
  return rapporter.filter(r => r.week === vecka);
}

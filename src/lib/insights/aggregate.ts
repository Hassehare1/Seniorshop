// Aggregeringarna bakom Översikt, utbrutna ur dashboard/page.tsx.
//
// Rena funktioner utan Prisma-beroende: in går enkla tal, ut kommer aggregat.
// Det gör dem testbara — de körde tidigare bara i en 500-radig sida och hade
// inga tester alls, trots att det är precis den sortens härledda tal där vi
// hittat fel förut.
//
// Beloppen konverteras från Decimal till number INNAN de skickas hit, ett besök
// i taget. Summeringen sker alltså på samma sätt som förut.

/** Ett besök, tillplattat till det aggregeringen behöver. */
export type VisitInput = {
  customerType: string;
  /** Försäljning ink. moms. */
  sales: number;
  ftFee: number;
  mfFee: number;
  numberOfCustomers: number;
  isFashionShow: boolean;
  isHangerShow: boolean;
};

/** En veckorapport med sina besök. */
export type ReportInput = {
  week: number;
  districtId: string;
  districtNumber: number;
  districtName: string;
  visits: VisitInput[];
};

export interface TypeAgg {
  type: string;
  sales: number;
  ftFee: number;
  mfFee: number;
  customers: number;
  besok: number;
  fashionShows: number;
  hangerShows: number;
  /** Försäljning per vecka, i samma ordning som `weeks`. */
  weekly: number[];
}

export interface DistAgg extends Omit<TypeAgg, "type"> {
  id: string;
  label: string;
  /** Den del av raden ovan som är mindre försäljning. Se MINOR_SALES_TYPE. */
  minor: MinorSales;
}

/**
 * Kundtypen som räknas bort ur snittet per besök — men BARA därifrån.
 *
 * Mindre försäljning är lagerförsäljning och småpartier hemma hos någon, inte
 * ett besök i den mening snittkvittot mäter. Posterna är många och små: över
 * all pilotdata ligger de på ~3 600 kr mot ~16 800 kr för övriga besök, och i
 * D12 — där 43 av 198 besök är en enda kund som heter "Lagerförsäljning" —
 * drog de ned snittet med 19 %. Senior Shop räknar därför bort dem när snittet
 * diskuteras med FT, och portalen följer samma definition så att FT ser samma
 * tal i portalen som de hör på uppföljningen.
 *
 * Omsättningen och antalet besök är fortfarande totalerna, inklusive mindre
 * försäljning. Det är de som rapporteras och faktureras — bara snittet tvättas.
 * Följden är att snittet INTE är omsättning ÷ besök, och det måste stå utskrivet
 * där talet visas.
 */
export const MINOR_SALES_TYPE = "MINDRE_FORSALJNING";

/** Den del av ett utfall som inte räknas in i snittet per besök. */
export type MinorSales = { sales: number; besok: number };

/**
 * Snitt per besök med mindre försäljning borträknad ur BÅDE täljare och nämnare.
 *
 * Bor här och används av målkortet, admin-översikten, analyskorten och
 * AI-assistenten. Räkningen fanns tidigare utskriven på fyra ställen som
 * `sales / besok`; med två definitioner i omlopp är det bara en tidsfråga
 * innan de glider isär.
 */
export function avgPerVisitExclMinor(sales: number, besok: number, minor: MinorSales): number {
  const namnare = besok - minor.besok;
  return namnare > 0 ? (sales - minor.sales) / namnare : 0;
}

/** Modevisning och galge är ömsesidigt uteslutande, så delarna summerar till totalen. */
export type ShowSplit = {
  modevisning: { sales: number; besok: number };
  galge: { sales: number; besok: number };
  ovriga: { sales: number; besok: number };
};

/** Kundtyperna i visningsordning. Okända typer räknas som OVRIGT. */
export const TYPE_KEYS = [
  "ALDREBOENDE",
  "TRAFFPUNKTER",
  "PENSIONARSFORENING",
  "FORENING_STOD_HALSA",
  "OVRIGA_FORENINGAR",
  "FORSAMLINGSHEM",
  "PLUS_55",
  "EGET_ARRANGEMANG",
  "CAMPINGPLATSER",
  "MINDRE_FORSALJNING",
  "OVRIGT",
] as const;

/**
 * Unika veckor i stigande ordning. Flera distrikt kan rapportera samma vecka —
 * utan dedup dubbleras x-axeln och staplarna splittras.
 */
export function uniqueWeeks(reports: { week: number }[]): number[] {
  return [...new Set(reports.map(r => r.week))].sort((a, b) => a - b);
}

function emptyType(type: string, weekCount: number): TypeAgg {
  return {
    type,
    sales: 0,
    ftFee: 0,
    mfFee: 0,
    customers: 0,
    besok: 0,
    fashionShows: 0,
    hangerShows: 0,
    weekly: new Array(weekCount).fill(0),
  };
}

function emptySplit(): ShowSplit {
  return {
    modevisning: { sales: 0, besok: 0 },
    galge: { sales: 0, besok: 0 },
    ovriga: { sales: 0, besok: 0 },
  };
}

/**
 * Aggregat per kundtyp, plus nedbrytning på visningstyp.
 *
 * Kundtyper utan besök utelämnas ur `byType`; `showType` innehåller alla nycklar
 * och filtreras av anroparen som förut.
 */
export function aggregateByType(
  reports: ReportInput[],
  weeks: number[],
): { byType: TypeAgg[]; showType: Record<string, ShowSplit> } {
  const weekIdx = new Map(weeks.map((w, i) => [w, i]));
  const aggMap: Record<string, TypeAgg> = {};
  const showMap: Record<string, ShowSplit> = {};
  for (const k of TYPE_KEYS) {
    aggMap[k] = emptyType(k, weeks.length);
    showMap[k] = emptySplit();
  }

  for (const r of reports) {
    const wi = weekIdx.get(r.week);
    for (const v of r.visits) {
      const a = aggMap[v.customerType] ?? aggMap.OVRIGT;
      a.sales += v.sales;
      a.ftFee += v.ftFee;
      a.mfFee += v.mfFee;
      a.customers += v.numberOfCustomers;
      a.besok += 1;
      if (v.isFashionShow) a.fashionShows += 1;
      if (v.isHangerShow) a.hangerShows += 1;
      if (wi !== undefined) a.weekly[wi] += v.sales;

      // Modevisning = hela besöket; annars galge; annars övriga.
      const cat = v.isFashionShow ? "modevisning" : v.isHangerShow ? "galge" : "ovriga";
      const s = (showMap[v.customerType] ?? showMap.OVRIGT)[cat];
      s.sales += v.sales;
      s.besok += 1;
    }
  }

  return {
    byType: TYPE_KEYS.map(k => aggMap[k]).filter(a => a.besok > 0),
    showType: showMap,
  };
}

/** Aggregat per distrikt, sorterat på distriktets etikett. */
export function aggregateByDistrict(reports: ReportInput[], weeks: number[]): DistAgg[] {
  const weekIdx = new Map(weeks.map((w, i) => [w, i]));
  const distMap: Record<string, DistAgg> = {};

  for (const r of reports) {
    let a = distMap[r.districtId];
    if (!a) {
      a = distMap[r.districtId] = {
        id: r.districtId,
        label: `D${r.districtNumber} – ${r.districtName}`,
        sales: 0,
        ftFee: 0,
        mfFee: 0,
        customers: 0,
        besok: 0,
        fashionShows: 0,
        hangerShows: 0,
        weekly: new Array(weeks.length).fill(0),
        minor: { sales: 0, besok: 0 },
      };
    }
    const wi = weekIdx.get(r.week);
    for (const v of r.visits) {
      a.sales += v.sales;
      a.ftFee += v.ftFee;
      a.mfFee += v.mfFee;
      a.customers += v.numberOfCustomers;
      a.besok += 1;
      if (v.isFashionShow) a.fashionShows += 1;
      if (v.isHangerShow) a.hangerShows += 1;
      if (wi !== undefined) a.weekly[wi] += v.sales;
      // Distriktsaggregatet har ingen typdimension, så mindre försäljning måste
      // räknas separat här — annars går snittet inte att tvätta per distrikt.
      if (v.customerType === MINOR_SALES_TYPE) {
        a.minor.sales += v.sales;
        a.minor.besok += 1;
      }
    }
  }

  return Object.values(distMap).sort((x, y) => x.label.localeCompare(y.label, "sv"));
}

/**
 * Utfallet som målkorten jämförs mot.
 *
 * `sales` och `visits` är totalerna, mindre försäljning inräknad. `avgPerVisit`
 * är tvättad — se MINOR_SALES_TYPE. `minor` följer med så att gränssnittet kan
 * skriva ut vad som räknats bort i stället för att bara visa ett tal som inte
 * går ihop med de två andra.
 */
export function goalActualsFrom(byType: TypeAgg[]): {
  sales: number;
  visits: number;
  avgPerVisit: number;
  fashionShows: number;
  minor: MinorSales;
} {
  const sales = byType.reduce((s, t) => s + t.sales, 0);
  const visits = byType.reduce((s, t) => s + t.besok, 0);
  const minorAgg = byType.find(t => t.type === MINOR_SALES_TYPE);
  const minor: MinorSales = { sales: minorAgg?.sales ?? 0, besok: minorAgg?.besok ?? 0 };
  return {
    sales,
    visits,
    avgPerVisit: avgPerVisitExclMinor(sales, visits, minor),
    fashionShows: byType.reduce((s, t) => s + t.fashionShows, 0),
    minor,
  };
}

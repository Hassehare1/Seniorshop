// Underlaget till Senior Shops veckorapport (admin-vyn /admin/veckorapport).
//
// Skiljer sig från resten av portalen på en punkt, och det är hela poängen:
// HÄR är mindre försäljning borta ur ALLA tal — omsättning, besök och antal
// kunder. Kolumnerna går därför ihop, snittet är omsättningen delad med
// besöken rakt av.
//
// Överallt annars i portalen är omsättning och besök totaler och bara snittet
// tvättat, eftersom totalen är det som rapporteras och faktureras. Se
// MINOR_SALES_TYPE i aggregate.ts. Blanda inte ihop de två vyerna: den här är
// underlag till en extern rapport, den andra är portalens egen sanning.

import { MINOR_SALES_TYPE } from "./aggregate.ts";

export type VeckoVisit = {
  customerType: string;
  /** Försäljning ink. moms. */
  sales: number;
  numberOfCustomers: number;
};

export type VeckoReport = {
  districtId: string;
  visits: VeckoVisit[];
};

export type VeckoDistrict = {
  id: string;
  number: number;
  name: string;
};

export type VeckoRad = {
  districtId: string;
  number: number;
  label: string;
  /** Rapportens fyra kolumner — alla utan mindre försäljning. */
  sales: number;
  besok: number;
  kunder: number;
  snitt: number;
  /**
   * Det som räknats bort, så att raden går att granska.
   *
   * Kunder och inte rader: en rad mindre försäljning är en hink med flera
   * enskilda småköp, och FT fyller i hur många i Antal kunder. "1 st" hade
   * varit antalet rader — den enda enheten på sidan som inte betyder något
   * för läsaren, och den som gav upphov till missförståndet.
   */
  bortSales: number;
  bortKunder: number;
  /** Portalens totaler för samma period, till fotnoten. */
  totalSales: number;
  totalBesok: number;
};

function tomRad(d: VeckoDistrict): VeckoRad {
  return {
    districtId: d.id,
    number: d.number,
    label: `D${d.number} – ${d.name}`,
    sales: 0,
    besok: 0,
    kunder: 0,
    snitt: 0,
    bortSales: 0,
    bortKunder: 0,
    totalSales: 0,
    totalBesok: 0,
  };
}

/**
 * En rad per distrikt, sorterat på distriktsnummer.
 *
 * Distrikt utan rapporter tas med som nollor i stället för att utelämnas. Ett
 * tyst distrikt är ett svar — det är just de raderna Anders idag får jaga per
 * mejl, och en rad som saknas ser ut som ett distrikt som inte finns.
 */
export function veckorapportRader(reports: VeckoReport[], districts: VeckoDistrict[]): VeckoRad[] {
  const rader = new Map(districts.map(d => [d.id, tomRad(d)]));

  for (const r of reports) {
    const rad = rader.get(r.districtId);
    // Rapporter för distrikt utanför urvalet hoppas över i stället för att
    // skapa en rad utan namn och nummer.
    if (!rad) continue;

    for (const v of r.visits) {
      rad.totalSales += v.sales;
      rad.totalBesok += 1;

      if (v.customerType === MINOR_SALES_TYPE) {
        rad.bortSales += v.sales;
        rad.bortKunder += v.numberOfCustomers;
        continue;
      }

      rad.sales += v.sales;
      rad.besok += 1;
      rad.kunder += v.numberOfCustomers;
    }
  }

  for (const rad of rader.values()) {
    rad.snitt = rad.besok > 0 ? rad.sales / rad.besok : 0;
  }

  return [...rader.values()].sort((a, b) => a.number - b.number);
}

/**
 * Summaraden.
 *
 * Snittet räknas på summorna, ALDRIG som ett medelvärde av distriktens snitt —
 * distrikten har olika många besök, och ett osviktat medelvärde ger ett annat
 * tal än summan delad med summan.
 */
export function veckorapportSumma(rader: VeckoRad[]): Omit<VeckoRad, "districtId" | "number" | "label"> {
  const s = rader.reduce(
    (acc, r) => ({
      sales: acc.sales + r.sales,
      besok: acc.besok + r.besok,
      kunder: acc.kunder + r.kunder,
      bortSales: acc.bortSales + r.bortSales,
      bortKunder: acc.bortKunder + r.bortKunder,
      totalSales: acc.totalSales + r.totalSales,
      totalBesok: acc.totalBesok + r.totalBesok,
    }),
    { sales: 0, besok: 0, kunder: 0, bortSales: 0, bortKunder: 0, totalSales: 0, totalBesok: 0 },
  );
  return { ...s, snitt: s.besok > 0 ? s.sales / s.besok : 0 };
}

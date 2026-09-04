// Kundregistrets tillstånd — hur komplett det är, per distrikt.
//
// Assistentens fem första verktyg svarar alla på samma sorts fråga: säsongens
// försäljning och mål. Registret självt var osynligt för den, så frågor som
// "hur många kunder saknar postnummer" gick inte att besvara.
//
// Prisma-fritt med flit, som resten av insights/: in går enkla rader, ut kommer
// summor. Det gör reglerna testbara utan databas.

export type RegisterKund = {
  districtId: string;
  active: boolean;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  contactPerson: string | null;
  postersA3: number;
  postersA4: number;
  digitalMaterial: boolean;
};

export type RegisterDistrikt = { id: string; number: number; name: string };

export type RegisterRad = {
  districtId: string;
  number: number;
  label: string;
  antal: number;
  aktiva: number;
  medPostnummer: number;
  utanPostnummer: number;
  medPostort: number;
  medTelefon: number;
  medKontaktperson: number;
  medSaljmaterial: number;
  /** Andel av distriktets kunder som har postnummer, i hela procent. */
  andelPostnummer: number;
};

/** Tomt, blanktecken och null räknas alla som "ifyllt saknas". */
function ifyllt(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim() !== "";
}

function harSaljmaterial(k: RegisterKund): boolean {
  return k.postersA3 > 0 || k.postersA4 > 0 || k.digitalMaterial;
}

function tom(d: RegisterDistrikt): RegisterRad {
  return {
    districtId: d.id,
    number: d.number,
    label: `D${d.number} – ${d.name}`,
    antal: 0,
    aktiva: 0,
    medPostnummer: 0,
    utanPostnummer: 0,
    medPostort: 0,
    medTelefon: 0,
    medKontaktperson: 0,
    medSaljmaterial: 0,
    andelPostnummer: 0,
  };
}

/**
 * En rad per distrikt, sorterat på distriktsnummer.
 *
 * Distrikt utan kunder tas med som nollrader. Ett distrikt som inte lagt in
 * någonting är ett svar i sig — utelämnas raden ser det ut som att distriktet
 * inte finns, och det är just de som är mest intressanta att fråga efter.
 */
export function kundregisterRader(
  kunder: RegisterKund[],
  distrikt: RegisterDistrikt[],
): RegisterRad[] {
  const rader = new Map(distrikt.map(d => [d.id, tom(d)]));

  for (const k of kunder) {
    const rad = rader.get(k.districtId);
    // Kunder i distrikt utanför urvalet hoppas över i stället för att skapa en
    // rad utan nummer och namn.
    if (!rad) continue;

    rad.antal += 1;
    if (k.active) rad.aktiva += 1;
    if (ifyllt(k.postalCode)) rad.medPostnummer += 1;
    else rad.utanPostnummer += 1;
    if (ifyllt(k.city)) rad.medPostort += 1;
    if (ifyllt(k.phone)) rad.medTelefon += 1;
    if (ifyllt(k.contactPerson)) rad.medKontaktperson += 1;
    if (harSaljmaterial(k)) rad.medSaljmaterial += 1;
  }

  for (const rad of rader.values()) {
    rad.andelPostnummer = rad.antal > 0 ? Math.round((rad.medPostnummer / rad.antal) * 100) : 0;
  }

  return [...rader.values()].sort((a, b) => a.number - b.number);
}

/**
 * Summaraden.
 *
 * Andelen räknas på summorna, ALDRIG som ett medelvärde av distriktens andelar
 * — distrikten har olika många kunder, och ett osviktat medelvärde ger ett
 * annat tal än summan delad med summan.
 */
export function kundregisterSumma(rader: RegisterRad[]): Omit<RegisterRad, "districtId" | "number" | "label"> {
  const s = rader.reduce(
    (a, r) => ({
      antal: a.antal + r.antal,
      aktiva: a.aktiva + r.aktiva,
      medPostnummer: a.medPostnummer + r.medPostnummer,
      utanPostnummer: a.utanPostnummer + r.utanPostnummer,
      medPostort: a.medPostort + r.medPostort,
      medTelefon: a.medTelefon + r.medTelefon,
      medKontaktperson: a.medKontaktperson + r.medKontaktperson,
      medSaljmaterial: a.medSaljmaterial + r.medSaljmaterial,
    }),
    { antal: 0, aktiva: 0, medPostnummer: 0, utanPostnummer: 0, medPostort: 0, medTelefon: 0, medKontaktperson: 0, medSaljmaterial: 0 },
  );
  return {
    ...s,
    andelPostnummer: s.antal > 0 ? Math.round((s.medPostnummer / s.antal) * 100) : 0,
  };
}

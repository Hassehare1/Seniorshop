/**
 * Rubriktexten i FT:s Excel → kundtyp.
 *
 * Bor här och inte i customerTypes.ts: det här är hur FT:s fil ser ut, inte hur
 * portalen visar kategorier. Att hålla dem isär gör också att den här filen kan
 * testas med `node --test` utan lib-till-lib-import.
 *
 * Både den nya och den gamla uppsättningen finns med — gamla filer ska
 * fortsätta gå att läsa in.
 */
export const importHeaderToType: Record<string, string> = {
  // Nuvarande uppsättning (slutrapporten, fliken Rapport)
  "äldreboende": "ALDREBOENDE",
  "träffpunkter": "TRAFFPUNKTER",
  "pensionärsförening": "PENSIONARSFORENING",
  "pensionärsförning": "PENSIONARSFORENING", // stavfel i tidiga filer
  "förening stöd & hälsoverksamhet": "FORENING_STOD_HALSA",
  "förening stöd och hälsoverksamhet": "FORENING_STOD_HALSA",
  "övriga föreningar": "OVRIGA_FORENINGAR",
  "församlingshem arrangerat av kyrkan": "FORSAMLINGSHEM",
  "församlingshem": "FORSAMLINGSHEM",
  "55+": "PLUS_55",
  "eget arrangemang": "EGET_ARRANGEMANG",
  "campingplatser": "CAMPINGPLATSER",
  "mindre försäljning": "MINDRE_FORSALJNING",
  // Äldre uppsättning
  "vårdhem": "ALDREBOENDE",
  "träffpunkt": "TRAFFPUNKTER",
  "förening": "OVRIGA_FORENINGAR",
  "boende +55": "PLUS_55",
  "boende+55": "PLUS_55",
  // Johans beslut 2026-08-18: gamla filers Övrigt hör hemma i Mindre försäljning.
  "övrigt": "MINDRE_FORSALJNING",
};

/** Rubriker jämförs normaliserade: gemener, hopdragna mellanslag, utan radbrytningar. */
export function normalizeHeader(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Kundtypen för en rubriktext, eller null om rubriken inte är en kategori. */
export function typeFromHeader(header: unknown): string | null {
  if (typeof header !== "string") return null;
  return importHeaderToType[normalizeHeader(header)] ?? null;
}

export type SheetLayout = {
  /** 0-indexerad rad där rubrikerna står. Data börjar raden efter. */
  headerRow: number;
  week: number;
  name: number;
  fashionShow: number | null;
  customers: number | null;
  comment: number | null;
  /** Kategorikolumnerna i den ordning de står i filen, vänster till höger. */
  typeCols: { col: number; type: string }[];
};

/** Minsta antal igenkända kategorirubriker för att en rad ska räknas som rubrikrad. */
const MIN_KATEGORIER = 3;

const RUBRIKER = {
  week: ["vecka"],
  name: ["namn på besök", "namn"],
  fashionShow: ["modevisning"],
  customers: ["antal kunder"],
  comment: ["kommentar"],
} as const;

function hitta(rad: unknown[], alternativ: readonly string[]): number | null {
  for (const alt of alternativ) {
    const i = rad.findIndex(c => typeof c === "string" && normalizeHeader(c) === alt);
    if (i !== -1) return i;
  }
  return null;
}

/**
 * Var kolumnerna ligger i FT:s slutrapport.
 *
 * Kolumnerna hittas på RUBRIK, aldrig på position. Formatet har redan flyttat
 * sig en gång: när kategorierna utökades från fem till tio sköts de gamla
 * kolumnerna tio steg åt höger, och importen — som läste fasta positioner E–I —
 * hittade plötsligt ingen data alls. Med rubrikmatchning spelar placeringen
 * ingen roll, och en tillagd kolumn kan inte längre knuffa isär inläsningen.
 *
 * Rubrikraden är den rad som innehåller flest igenkända kategorinamn. Både den
 * nya och den gamla uppsättningen känns igen, så äldre filer fungerar fortsatt.
 * Innehåller filen båda uppsättningarna sida vid sida vinner den vänstra, vilket
 * gör att en fil mitt i övergången läses som den nya.
 */
export function findLayout(rows: unknown[][]): SheetLayout | null {
  let bästa: { rad: number; kategorier: { col: number; type: string }[] } | null = null;

  rows.forEach((r, ri) => {
    if (!Array.isArray(r)) return;
    const kategorier: { col: number; type: string }[] = [];
    r.forEach((cell, ci) => {
      const type = typeFromHeader(cell);
      if (type) kategorier.push({ col: ci, type });
    });
    if (kategorier.length >= MIN_KATEGORIER && (!bästa || kategorier.length > bästa.kategorier.length)) {
      bästa = { rad: ri, kategorier };
    }
  });

  if (!bästa) return null;
  const { rad, kategorier } = bästa as { rad: number; kategorier: { col: number; type: string }[] };

  const r = rows[rad];
  const week = hitta(r, RUBRIKER.week);
  const name = hitta(r, RUBRIKER.name);
  if (week === null || name === null) return null;

  return {
    headerRow: rad,
    week,
    name,
    fashionShow: hitta(r, RUBRIKER.fashionShow),
    customers: hitta(r, RUBRIKER.customers),
    comment: hitta(r, RUBRIKER.comment),
    typeCols: kategorier,
  };
}

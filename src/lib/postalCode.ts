// Postnummer på kund. Lagras som enbart siffror utan mellanslag ("12345") så
// att värdet går att slå upp och gruppera på — fältet finns för att kunna
// analysera försäljningen geografiskt, och då förstör blandade format tyst.
//
// Antal siffror följer distriktets region.
const DIGITS_PER_REGION: Record<string, number> = { SE: 5, FI: 5, DK: 4 };

export function postalCodeDigits(region?: string | null): number {
  return DIGITS_PER_REGION[region ?? "SE"] ?? 5;
}

/** Plockar ut siffrorna ur inmatningen: "123 45" → "12345". */
export function normalizePostalCode(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Returnerar null när värdet duger att spara, annars ett felmeddelande.
 * Tomt är giltigt — fältet är frivilligt.
 */
export function validatePostalCode(raw: string, region?: string | null): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Bokstäver ska inte tyst försvinna i normaliseringen — "12A45" är ett
  // misstag, inte ett postnummer.
  if (/[^\d\s-]/.test(trimmed)) return "Postnummer får bara innehålla siffror";

  const expected = postalCodeDigits(region);
  const digits = normalizePostalCode(trimmed);
  if (digits.length !== expected) return `Postnummer ska vara ${expected} siffror`;

  return null;
}

/** Visningsform: svenska postnummer skrivs "123 45", övriga rakt av. */
export function formatPostalCode(code?: string | null, region?: string | null): string {
  if (!code) return "";
  const digits = normalizePostalCode(code);
  if ((region ?? "SE") === "SE" && digits.length === 5) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return digits;
}

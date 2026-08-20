/**
 * Säljmaterialet som skickas till en kund inför besöket.
 *
 * Antal styr allt: noll affischer betyder att formatet inte skickas, så
 * "har A3" är entydigt utan en separat kryssruta som kan säga emot antalet.
 * Digitalt har inget antal och är därför en egen flagga med en notering om
 * vad som skickas (prislista, bildbank, …).
 */
export type SalesMaterial = {
  postersA3: number;
  postersA4: number;
  digitalMaterial: boolean;
  digitalMaterialNote?: string | null;
};

export type MaterialFilter = "all" | "a3" | "a4" | "digital" | "none";

export const materialFilterOptions: { value: MaterialFilter; label: string }[] = [
  { value: "all", label: "Allt säljmaterial" },
  { value: "a3", label: "Har A3" },
  { value: "a4", label: "Har A4" },
  { value: "digital", label: "Har digitalt" },
  { value: "none", label: "Saknar material" },
];

/** Har kunden något material alls inlagt? */
export function hasMaterial(m: SalesMaterial): boolean {
  return m.postersA3 > 0 || m.postersA4 > 0 || m.digitalMaterial;
}

export function matchesMaterialFilter(m: SalesMaterial, filter: MaterialFilter): boolean {
  switch (filter) {
    case "a3": return m.postersA3 > 0;
    case "a4": return m.postersA4 > 0;
    case "digital": return m.digitalMaterial;
    case "none": return !hasMaterial(m);
    default: return true;
  }
}

/**
 * Kort sammanfattning för listor och export: "2 × A3 · Digitalt".
 * Tom sträng när inget är inlagt — anropande vy avgör hur det ska visas.
 */
export function materialSummary(m: SalesMaterial): string {
  const delar: string[] = [];
  if (m.postersA3 > 0) delar.push(`${m.postersA3} × A3`);
  if (m.postersA4 > 0) delar.push(`${m.postersA4} × A4`);
  if (m.digitalMaterial) {
    const not = m.digitalMaterialNote?.trim();
    delar.push(not ? `Digitalt (${not})` : "Digitalt");
  }
  return delar.join(" · ");
}

/** Tolkar ett formulärvärde till ett giltigt antal — aldrig negativt, aldrig NaN. */
export function parseAntal(värde: unknown): number {
  const n = Math.floor(Number(värde));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Möteslokalen ryms på en rad i kundkortet och i kommande utskick — därav
 * taket. Gränsen bor här så att formulär, API och tester läser samma siffra.
 */
export const VENUE_MAX_LENGTH = 50;

/** Returnerar ett felmeddelande om lokalen är för lång, annars null. */
export function validateVenue(värde: string): string | null {
  return värde.trim().length > VENUE_MAX_LENGTH
    ? `Möteslokalen får vara högst ${VENUE_MAX_LENGTH} tecken.`
    : null;
}

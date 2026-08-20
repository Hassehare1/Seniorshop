/**
 * Möteslokalen — var besöket äger rum när det inte är på kundens adress.
 *
 * Taket finns för att lokalen ska rymmas på en rad i kundkortet och i
 * kommande utskick. Gränsen bor här så att formulär, API och tester läser
 * samma siffra.
 */
export const VENUE_MAX_LENGTH = 50;

/** Returnerar ett felmeddelande om lokalen är för lång, annars null. */
export function validateVenue(värde: string): string | null {
  return värde.trim().length > VENUE_MAX_LENGTH
    ? `Möteslokalen får vara högst ${VENUE_MAX_LENGTH} tecken.`
    : null;
}

import { logg } from "./logg.ts";

/**
 * Felhantering för API-routerna.
 *
 * LÄGET FÖRE: 30 av 35 route-handlers saknade try/catch. Ett Prisma-fel — en
 * unikhetskrock, en främmande nyckel som pekade fel, en transaktion som tog
 * för lång tid — blev en tom 500 utan text. Användaren fick "Något gick fel"
 * och hade ingenting att felanmäla med.
 *
 * `onRequestError` i src/instrumentation.ts loggar redan sådana fall, men den
 * kan inte forma svaret: routen har redan misslyckats när Next fångar felet.
 * Det som saknades var översättningen från databasfel till begripligt svar.
 *
 * ANVÄNDNING — en rad per handler:
 *
 *   export const POST = medFelhantering(async (req: NextRequest) => { ... });
 *
 * Omslaget i stället för handskrivna catch-block är ett medvetet val: 35
 * catch-block är 35 tillfällen att glömma ett, och nästa route som skrivs
 * skulle börja om från noll.
 *
 * Modulen importerar inget från next/server — samma skäl som lib/validering.ts.
 */

/** Prisma-felkoder vi kan säga något vettigt om. Övriga blir 500. */
const PRISMA_FEL: Record<string, { status: number; meddelande: string }> = {
  // Unikhetskrock — posten finns redan (t.ex. samma e-post, samma distriktsnr)
  P2002: { status: 409, meddelande: "Det finns redan en post med de uppgifterna." },
  // Posten som skulle ändras eller raderas fanns inte
  P2025: { status: 404, meddelande: "Posten hittades inte." },
  // Främmande nyckel pekar på något som inte finns
  P2003: { status: 400, meddelande: "Uppgiften hänvisar till något som inte finns." },
  // Värdet är för långt för kolumnen
  P2000: { status: 400, meddelande: "Ett värde är för långt för att sparas." },
};

/**
 * Känner igen ett Prisma-fel utan att importera Prisma.
 *
 * Duck-typing med flit: `import { Prisma } from "@prisma/client"` hade dragit
 * in den genererade klienten i en modul som annars är ren, och gjort den
 * tyngre att testa. Koderna har formen P + fyra siffror och är en stabil del
 * av Prismas publika API.
 */
function prismaKod(fel: unknown): string | null {
  if (typeof fel !== "object" || fel === null || !("code" in fel)) return null;
  const kod = (fel as { code: unknown }).code;
  return typeof kod === "string" && /^P\d{4}$/.test(kod) ? kod : null;
}

/**
 * Kort kod som användaren kan läsa upp och som går att söka på i loggen.
 *
 * Samma roll som `digest` har för sidfel i error.tsx. Utan den är ett
 * felmeddelande från en franchisetagare omöjligt att koppla till en loggrad.
 * Tecknen är valda så att koden går att läsa i telefon: inga 0/O, 1/I eller
 * andra par som hörs likadant.
 */
const TECKEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function nyFelkod(slump: () => number = Math.random): string {
  let kod = "";
  for (let i = 0; i < 6; i++) kod += TECKEN[Math.floor(slump() * TECKEN.length)];
  return kod;
}

export type Sammanhang = { metod?: string; vag?: string };

/**
 * Översätter ett fångat fel till ett svar, och loggar det.
 *
 * Kända databasfel får en riktig statuskod och en mening användaren förstår.
 * Allt annat blir 500 med en felkod — aldrig det tekniska felmeddelandet:
 * ett Prisma-fel kan innehålla kolumnnamn, värden och delar av frågan, och
 * portalen hanterar personuppgifter.
 */
export function felsvar(fel: unknown, sammanhang: Sammanhang = {}): Response {
  const kod = prismaKod(fel);
  const kant = kod ? PRISMA_FEL[kod] : undefined;

  if (kant) {
    // Förväntat utfall, inte ett haveri — loggas som varning så att en riktig
    // felnivå fortsätter betyda något.
    logg.varning("Databasen avvisade en begäran", { ...sammanhang, prismaKod: kod, status: kant.status });
    return Response.json({ error: kant.meddelande }, { status: kant.status });
  }

  const felkod = nyFelkod();
  logg.fel("Ohanterat fel i API-route", fel, { ...sammanhang, felkod, ...(kod ? { prismaKod: kod } : {}) });
  return Response.json(
    {
      error: `Något gick fel på servern. Ange felkod ${felkod} om du kontaktar support.`,
      felkod,
    },
    { status: 500 },
  );
}

/**
 * Omsluter en route-handler så att ingenting kan kastas ohanterat ur den.
 *
 * Typerna är strukturella: `req` behöver bara ha metod och url för loggen,
 * vilket NextRequest har. Resten av argumenten (Next skickar `{ params }` på
 * dynamiska routes) skickas vidare orörda.
 */
export function medFelhantering<
  R extends { method: string; url: string },
  Args extends unknown[],
>(handler: (req: R, ...args: Args) => Promise<Response>) {
  return async (req: R, ...args: Args): Promise<Response> => {
    try {
      return await handler(req, ...args);
    } catch (fel) {
      // Bara sökvägen, aldrig query-strängen: den kan innehålla söktermer och
      // distrikts-id och hör inte hemma i en loggrad tillsammans med ett fel.
      let vag = req.url;
      try {
        vag = new URL(req.url).pathname;
      } catch {
        /* url var inte absolut — behåll som den är */
      }
      return felsvar(fel, { metod: req.method, vag });
    }
  };
}

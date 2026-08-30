import { z } from "zod";
// Explicit .ts-ändelse: utan den kan `node --test` inte lösa upp sökvägen, och
// modulen blir otestbar. Samma skäl som testfilerna importerar med ändelse.
import { VENUE_MAX_LENGTH } from "./venue.ts";
import { LOSENORD_MIN } from "./losenordskrav.ts";

/**
 * Indatavalidering för API-routerna.
 *
 * FÖRE DEN HÄR MODULEN gick fält från `req.json()` delvis rakt in i Prisma.
 * Ett namn kunde vara ett objekt, en notering kunde vara tio megabyte, och
 * `newPassword.length < 6` släppte igenom ett TAL — `.length` är `undefined`
 * på ett tal, och `undefined < 6` är falskt. Trasig JSON gav dessutom ett
 * ohanterat undantag redan på `await req.json()`.
 *
 * ANVÄNDNING — samma form som requireSession i lib/authz.ts, med flit, så att
 * en route läser likadant hela vägen ned:
 *
 *   const session = await requireSession();
 *   if (session instanceof NextResponse) return session;
 *
 *   const data = await las(req, Schema);
 *   if (data instanceof Response) return data;
 *   // data är nu validerad OCH typad — ingen cast behövs
 *
 * Schemat för en route bor i routen själv, byggt av primitiverna här nedanför.
 * Det håller schemat bredvid det som använder det, och den här filen liten.
 *
 * VARFÖR `Response` OCH INTE `NextResponse`: den här modulen importerar
 * ingenting från next/server. `next/server` går inte att ladda under
 * `node --test`, och ett sådant beroende hade gjort valideringen otestbar —
 * exakt den kopplingen som gör resten av API-lagret otestbart i dag.
 * `Response.json()` är ett standard-API, en route får returnera ett vanligt
 * `Response`, och NextResponse ÄR ett Response — så `instanceof Response`
 * fångar både det här svaret och det från requireSession.
 */

/**
 * Okända fält STRIPPAS av zod som standard, och det är en säkerhetsegenskap:
 * skickar någon `{ namn: "x", approved: true }` till en route som bara känner
 * till `namn` försvinner `approved` innan det kan nå Prisma. Lägg därför
 * aldrig till `.passthrough()` på ett schema som matar en skrivning.
 */
export async function las<S extends z.ZodType>(
  // Tar bara det den faktiskt använder i stället för hela NextRequest.
  // NextRequest uppfyller formen, och funktionen blir testbar utan
  // Next-runtime — vilket är skillnaden mellan att ha tester och att inte ha.
  req: { json(): Promise<unknown> },
  schema: S,
): Promise<z.infer<S> | Response> {
  let kropp: unknown;
  try {
    kropp = await req.json();
  } catch {
    // Trasig eller tom kropp. Tidigare ett ohanterat undantag och en tom 500.
    return Response.json({ error: "Förfrågan innehöll ingen giltig JSON." }, { status: 400 });
  }

  const resultat = schema.safeParse(kropp);
  if (!resultat.success) {
    const meddelanden = resultat.error.issues.map((i) => i.message);
    return Response.json(
      // `error` är den enda sträng klienterna visar i dag. `fel` finns för den
      // som vill lista alla — inget i gränssnittet läser den ännu.
      { error: meddelanden[0] ?? "Ogiltig förfrågan.", fel: meddelanden },
      { status: 400 },
    );
  }
  return resultat.data;
}

/* ------------------------------------------------------------------ *
 * Primitiver
 *
 * Längdgränserna är omdömesfrågor, inte naturlagar. De är satta för att
 * rymma verkliga värden med god marginal och samtidigt hindra att någon
 * skriver en roman i ett kundnamn. Ändra dem här, inte i en enskild route.
 * ------------------------------------------------------------------ */

/** Databas-id (cuid). Aldrig från användaren — men aldrig heller ovaliderat. */
export const id = (falt = "Id") =>
  z.string({ error: `${falt} saknas.` }).trim().min(1, `${falt} saknas.`).max(64, `${falt} är ogiltigt.`);

/** Obligatorisk kort fritext. */
export const text = (falt: string, max: number) =>
  z
    .string({ error: `${falt} måste anges.` })
    .trim()
    .min(1, `${falt} får inte vara tomt.`)
    .max(max, `${falt} får vara högst ${max} tecken.`);

/**
 * Frivillig fritext. Tom sträng blir null — så att "rensa fältet" och "rör
 * inte fältet" blir två olika saker: utelämnat fält = orört, tom sträng =
 * rensat. Flera PATCH-routes bygger redan på den skillnaden.
 */
export const valfriText = (falt: string, max: number) =>
  z
    .string({ error: `${falt} måste vara text.` })
    .trim()
    .max(max, `${falt} får vara högst ${max} tecken.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const epost = z
  .string({ error: "E-postadress måste anges." })
  .trim()
  .toLowerCase()
  .min(1, "E-postadress måste anges.")
  .max(200, "E-postadressen är för lång.")
  .pipe(z.email("Ange en giltig e-postadress."));

// Kravet bor i en egen, beroendefri fil så att formulären kan läsa samma
// siffra utan att dra in zod i webbläsarens paket. Se lib/losenordskrav.ts.
export { LOSENORD_MIN } from "./losenordskrav.ts";

export const losenord = z
  .string({ error: "Lösenord måste anges." })
  .min(LOSENORD_MIN, `Lösenordet måste vara minst ${LOSENORD_MIN} tecken.`)
  .max(200, "Lösenordet är för långt.");

/**
 * Heltal ur ett formulär. `coerce` för att fälten ibland kommer som strängar
 * ("12"), men NaN och tom sträng avvisas — vilket är hela poängen: ett tomt
 * veckofält gav tidigare NaN hela vägen ned i Prisma och en ohanterad 500.
 */
export const heltal = (falt: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${falt} måste vara ett tal.` })
    .int(`${falt} måste vara ett heltal.`)
    .min(min, `${falt} måste vara minst ${min}.`)
    .max(max, `${falt} kan inte vara högre än ${max}.`);

/** ISO-veckonummer. 53 finns — vissa år har en vecka 53. */
export const veckonummer = (falt = "Vecka") => heltal(falt, 1, 53);

/**
 * Penningbelopp i kronor. Taket är avsiktligt högt men ändligt: en veckas
 * försäljning på en miljard är ett inmatningsfel, inte en försäljning.
 */
export const belopp = (falt: string) =>
  z.coerce
    .number({ error: `${falt} måste vara ett belopp.` })
    .min(0, `${falt} kan inte vara negativt.`)
    .max(1_000_000_000, `${falt} är orimligt stort.`);

/** Antal av något icke-negativt (besökare, affischer). */
export const antal = (falt: string, max = 100_000) => heltal(falt, 0, max);

/**
 * Avgiftssats som andel (0,075 = 7,5 %). Taket på 1 är inte kosmetik: en
 * sats över 100 % skulle betyda att franchisetagaren betalar mer än hon
 * sålt för, och routen som sätter den hade tidigare ingen kontroll alls.
 */
export const andel = (falt: string) =>
  z.coerce
    .number({ error: `${falt} måste vara ett tal.` })
    .min(0, `${falt} kan inte vara negativ.`)
    .max(1, `${falt} anges som andel (0,075 = 7,5 %) och kan inte överstiga 1.`);

export const boolean = (falt: string) =>
  z.boolean({ error: `${falt} måste vara sant eller falskt.` });

/** Möteslokal — samma tak som formuläret och testerna använder. */
export const moteslokal = valfriText("Möteslokalen", VENUE_MAX_LENGTH);

/**
 * Enum ur Prisma-schemat, med ett begripligt svenskt fel.
 *
 * Objektformen bevarar literal-typerna (`"ADMIN" | "FRANCHISEE"` och inte
 * `string`), vilket är nödvändigt: Prisma tar emot enum-värden, inte
 * godtyckliga strängar, och utan det skulle varje anropare behöva en cast.
 */
export const enumFalt = <T extends Record<string, string>>(varden: T, falt: string) =>
  z.enum(varden, { error: `${falt} är inte ett giltigt värde.` });

export { z };

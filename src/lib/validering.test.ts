import { test } from "node:test";
import assert from "node:assert/strict";
import {
  las, z, id, text, valfriText, epost, losenord, LOSENORD_MIN,
  veckonummer, belopp, antal, andel, boolean, enumFalt,
} from "./validering.ts";

/** Minimal ersättare för NextRequest — las() rör bara json(). */
const begaran = (kropp: unknown) => ({ json: async () => kropp });
const trasig = () => ({ json: async () => { throw new SyntaxError("Unexpected token"); } });

/** Plockar ut felmeddelandet ur ett 400-svar. */
async function felet(svar: Response): Promise<string> {
  return (await svar.json()).error;
}

test("las släpper igenom giltig indata och returnerar den typad", async () => {
  const schema = z.object({ namn: text("Namn", 50) });
  const ut = await las(begaran({ namn: "  Skogsrået  " }), schema);
  assert.ok(!(ut instanceof Response));
  assert.equal(ut.namn, "Skogsrået", "ska trimma");
});

test("las svarar 400 i stället för att kasta på trasig JSON", async () => {
  const ut = await las(trasig(), z.object({ a: text("A", 5) }));
  assert.ok(ut instanceof Response);
  assert.equal(ut.status, 400);
  assert.match(await felet(ut), /giltig JSON/);
});

test("las strippar okända fält — skydd mot mass-assignment", async () => {
  const schema = z.object({ namn: text("Namn", 50) });
  const ut = await las(begaran({ namn: "Eken", approved: true, role: "ADMIN" }), schema);
  assert.ok(!(ut instanceof Response));
  assert.deepEqual(ut, { namn: "Eken" });
});

test("las returnerar första felet i error och alla i fel", async () => {
  const schema = z.object({ a: text("A", 5), b: text("B", 5) });
  const ut = await las(begaran({}), schema);
  assert.ok(ut instanceof Response);
  const kropp = await ut.json();
  assert.equal(kropp.error, "A måste anges.");
  assert.equal(kropp.fel.length, 2);
});

test("felmeddelandena böjer inte adjektiv efter genus", () => {
  // Svenska adjektiv böjs efter ordets genus: "Adressen är tom" men
  // "Kundnamnet är tomt". Fältnamnen som skickas in är blandade en- och
  // ett-ord, så ETT böjt ord i mallen blir alltid fel för hälften av dem.
  // "Försäljningen kan inte vara negativt" gick faktiskt i produktion.
  //
  // Testet jämför mallen med ett en-ord mot samma mall med ett ett-ord:
  // är resten av meningen identisk bär den ingen genusform.
  const utanFalt = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } },
                    falt: string) =>
    schema.safeParse(-5).error!.issues[0].message.replace(falt, "«FÄLT»");

  for (const bygg of [belopp, andel]) {
    assert.equal(
      utanFalt(bygg("Försäljningen"), "Försäljningen"),   // en-ord
      utanFalt(bygg("MF-taket"), "MF-taket"),             // ett-ord
      "samma mall ska ge samma mening oavsett fältets genus",
    );
  }

  const tomtEn = text("Adressen", 50).safeParse("").error!.issues[0].message;
  const tomtEtt = text("Kundnamnet", 50).safeParse("").error!.issues[0].message;
  assert.equal(tomtEn.replace("Adressen", "«FÄLT»"), tomtEtt.replace("Kundnamnet", "«FÄLT»"));

  // Och konkret: de böjda formerna ska inte förekomma alls.
  const alla = [
    belopp("Försäljningen").safeParse(-1).error!.issues[0].message,
    andel("FT-avgiften").safeParse(-1).error!.issues[0].message,
    text("Adressen", 50).safeParse("").error!.issues[0].message,
  ].join(" ");
  for (const bojt of ["negativt", "negativ ", "vara tomt", "vara tom "]) {
    assert.ok(!alla.includes(bojt), `böjd form "${bojt}" finns kvar i ett meddelande`);
  }
});

test("lösenordskravet ligger på eller över NIST:s golv", () => {
  // Låser fast riktningen, inte siffran: kravet får höjas men aldrig sänkas
  // under åtta tecken (NIST SP 800-63B). Portalen låg på sex fram till
  // 2026-08-30. Utan det här testet är gränsen bara en siffra någon kan
  // skruva ned igen utan att något säger ifrån.
  assert.ok(LOSENORD_MIN >= 8, `LOSENORD_MIN är ${LOSENORD_MIN}, ska vara minst 8`);
});

test("losenord avvisar ett TAL — regressionstest för .length-buggen", () => {
  // `(12345678).length` är undefined, och `undefined < 6` är falskt, så den
  // gamla kontrollen `newPassword.length < 6` släppte igenom tal rakt in i
  // bcrypt.hash, som sedan kastade. Se punkt 5 i åtgärdslistan.
  assert.equal(losenord.safeParse(12345678).success, false);
  assert.equal(losenord.safeParse(null).success, false);
  assert.equal(losenord.safeParse({}).success, false);
  assert.equal(losenord.safeParse("x".repeat(LOSENORD_MIN)).success, true);
  assert.equal(losenord.safeParse("x".repeat(LOSENORD_MIN - 1)).success, false);
});

test("heltal avvisar NaN och tom sträng — regressionstest för säsongsbuggen", () => {
  // Ett tomt veckofält gav Number("") → NaN, som passerade den gamla
  // kontrollen och kastade först nere i Prisma.
  const v = veckonummer();
  assert.equal(v.safeParse(Number.NaN).success, false);
  assert.equal(v.safeParse("").success, false);
  assert.equal(v.safeParse(undefined).success, false);
  assert.equal(v.safeParse("12").success, true, "strängar från formulär ska tolkas");
  assert.equal(v.safeParse(12).success, true);
  assert.equal(v.safeParse(0).success, false, "vecka 0 finns inte");
  assert.equal(v.safeParse(54).success, false, "vecka 54 finns inte");
  assert.equal(v.safeParse(53).success, true, "vecka 53 finns vissa år");
  assert.equal(v.safeParse(12.5).success, false, "halva veckor finns inte");
});

test("andel kan inte överstiga 1 — en avgift över 100 % är alltid fel", () => {
  const a = andel("FT-avgiften");
  assert.equal(a.safeParse(0.075).success, true);
  assert.equal(a.safeParse(0).success, true);
  assert.equal(a.safeParse(1).success, true);
  assert.equal(a.safeParse(1.5).success, false);
  assert.equal(a.safeParse(-0.1).success, false);
  assert.equal(a.safeParse("abc").success, false);
  assert.match(a.safeParse(7.5).error!.issues[0].message, /andel/);
});

test("text kräver innehåll och håller taket", () => {
  const t = text("Namn", 10);
  assert.equal(t.safeParse("   ").success, false, "bara blanksteg är tomt");
  assert.equal(t.safeParse("x".repeat(11)).success, false);
  assert.equal(t.safeParse("x".repeat(10)).success, true);
  assert.equal(t.safeParse(123).success, false);
  assert.match(t.safeParse("").error!.issues[0].message, /Namn/);
});

test("valfriText gör tomt till null, så rensat skiljs från orört", () => {
  const v = valfriText("Notering", 20);
  assert.equal(v.parse("  "), null, "tom sträng = rensat");
  assert.equal(v.parse(undefined), null);
  assert.equal(v.parse(null), null);
  assert.equal(v.parse("  hej  "), "hej");
  assert.equal(v.safeParse("x".repeat(21)).success, false);
});

test("epost normaliserar och kräver giltigt format", () => {
  assert.equal(epost.parse("  Anna@Exempel.SE "), "anna@exempel.se");
  assert.equal(epost.safeParse("inte en adress").success, false);
  assert.equal(epost.safeParse("").success, false);
  assert.equal(epost.safeParse(42).success, false);
});

test("belopp avvisar negativt och orimligt", () => {
  const b = belopp("Försäljning");
  assert.equal(b.safeParse(0).success, true);
  assert.equal(b.safeParse("4500.50").success, true);
  assert.equal(b.safeParse(-1).success, false);
  assert.equal(b.safeParse(2_000_000_000).success, false);
  assert.equal(b.safeParse(Number.NaN).success, false);
});

test("antal och id håller sina gränser", () => {
  assert.equal(antal("Besökare").safeParse(-1).success, false);
  assert.equal(antal("Besökare").safeParse(0).success, true);
  assert.equal(id().safeParse("").success, false);
  assert.equal(id().safeParse("x".repeat(65)).success, false);
  assert.equal(id("Kund-id").safeParse("clx123abc").success, true);
});

test("boolean accepterar bara äkta boolean", () => {
  const b = boolean("REA");
  assert.equal(b.safeParse(true).success, true);
  assert.equal(b.safeParse("true").success, false, "strängen 'true' är inte true");
  assert.equal(b.safeParse(1).success, false);
});

test("enumFalt accepterar bara värden ur uppräkningen", () => {
  const e = enumFalt({ VAR: "VAR", HOST: "HOST" }, "Säsongstyp");
  assert.equal(e.safeParse("VAR").success, true);
  assert.equal(e.safeParse("SOMMAR").success, false);
  assert.equal(e.safeParse(1).success, false);
  assert.match(e.safeParse("SOMMAR").error!.issues[0].message, /Säsongstyp/);
});

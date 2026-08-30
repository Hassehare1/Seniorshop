import { test } from "node:test";
import assert from "node:assert/strict";
import { felsvar, medFelhantering, nyFelkod } from "./felhantering.ts";

/** Efterliknar ett Prisma-fel utan att dra in klienten. */
const prismafel = (code: string) =>
  Object.assign(new Error(`Invalid \`prisma.user.create()\` invocation: ${code}`), { code });

const kropp = async (svar: Response) => await svar.json();

test("unikhetskrock blir 409 med ett begripligt meddelande", async () => {
  const svar = felsvar(prismafel("P2002"));
  assert.equal(svar.status, 409);
  assert.match((await kropp(svar)).error, /finns redan/);
});

test("saknad post blir 404, felaktig referens 400", async () => {
  assert.equal(felsvar(prismafel("P2025")).status, 404);
  assert.equal(felsvar(prismafel("P2003")).status, 400);
  assert.equal(felsvar(prismafel("P2000")).status, 400);
});

test("okänd Prisma-kod blir 500, inte en gissning", async () => {
  // P1001 = kan inte nå databasen. Vi har inget vettigt att säga om den till
  // användaren, så den ska INTE översättas till något som låter hanterat.
  const svar = felsvar(prismafel("P1001"));
  assert.equal(svar.status, 500);
});

test("ett vanligt fel blir 500 med en felkod som går att söka på", async () => {
  const svar = felsvar(new Error("något oväntat"));
  assert.equal(svar.status, 500);
  const b = await kropp(svar);
  assert.match(b.error, /Ange felkod [A-Z2-9]{6}/);
  assert.match(b.felkod, /^[A-Z2-9]{6}$/);
  assert.ok(b.error.includes(b.felkod), "koden i texten ska vara samma som i fältet");
});

test("det tekniska felmeddelandet läcker ALDRIG till klienten", async () => {
  // Prisma-fel innehåller kolumnnamn, värden och delar av frågan. Portalen
  // hanterar personuppgifter — den texten får inte nå webbläsaren.
  const svar = felsvar(new Error("column \"passwordHash\" value 'hemlig' violates"));
  const text = JSON.stringify(await kropp(svar));
  assert.ok(!text.includes("passwordHash"), "kolumnnamn läckte");
  assert.ok(!text.includes("hemlig"), "värde läckte");
});

test("nyFelkod undviker tecken som hörs likadant i telefon", () => {
  const alla = Array.from({ length: 200 }, () => nyFelkod()).join("");
  for (const otydligt of ["0", "O", "1", "I"]) {
    assert.ok(!alla.includes(otydligt), `${otydligt} ska inte förekomma`);
  }
  assert.equal(nyFelkod(() => 0), "AAAAAA", "deterministisk med given slumpkälla");
});

test("medFelhantering släpper igenom ett lyckat svar orört", async () => {
  const handler = medFelhantering(async () => Response.json({ ok: true }, { status: 201 }));
  const svar = await handler({ method: "POST", url: "http://x/api/test" });
  assert.equal(svar.status, 201);
  assert.deepEqual(await kropp(svar), { ok: true });
});

test("medFelhantering fångar det som kastas och svarar i stället för att krascha", async () => {
  const handler = medFelhantering(async () => {
    throw prismafel("P2002");
  });
  const svar = await handler({ method: "POST", url: "http://x/api/users" });
  assert.equal(svar.status, 409);
});

test("medFelhantering skickar vidare params till handlern", async () => {
  const handler = medFelhantering(
    async (_req: { method: string; url: string }, ctx: { params: Promise<{ id: string }> }) =>
      Response.json({ id: (await ctx.params).id }),
  );
  const svar = await handler({ method: "PATCH", url: "http://x/api/kunder/k1" }, {
    params: Promise.resolve({ id: "k1" }),
  });
  assert.deepEqual(await kropp(svar), { id: "k1" });
});

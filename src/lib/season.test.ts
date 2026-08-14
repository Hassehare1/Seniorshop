import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveReportSeason, type SeasonLike } from "./season.ts";

const var2026: SeasonLike = { id: "v26", year: 2026, weekStart: 5, weekEnd: 26 };
const host2026: SeasonLike = { id: "h26", year: 2026, weekStart: 27, weekEnd: 48 };
const var2025: SeasonLike = { id: "v25", year: 2025, weekStart: 5, weekEnd: 26 };

test("veckan inom en säsong ger den säsongen", () => {
  assert.equal(resolveReportSeason([var2026, host2026], 10, 2026)?.id, "v26");
  assert.equal(resolveReportSeason([var2026, host2026], 33, 2026)?.id, "h26");
});

test("saknad säsong ger null i stället för att tyst välja en annan", () => {
  // Kärnan i buggen: vecka 33 med bara Vår 2026 inlagd hamnade förut i Vår 2026.
  assert.equal(resolveReportSeason([var2026], 33, 2026), null);
  // Glappet mellan säsongerna (vecka 49–52) hör inte till någon säsong
  assert.equal(resolveReportSeason([var2026, host2026], 50, 2026), null);
  assert.equal(resolveReportSeason([], 33, 2026), null);
});

test("fel år räknas inte som träff", () => {
  assert.equal(resolveReportSeason([var2025], 10, 2026), null);
});

test("uttrycklig säsong från URL väger tyngre än dagens datum", () => {
  // Redigera en gammal vecka mitt i en annan säsong
  assert.equal(resolveReportSeason([var2026, host2026], 33, 2026, "v26")?.id, "v26");
  // …och även i glappet mellan säsonger, där inget datum matchar
  assert.equal(resolveReportSeason([var2026, host2026], 50, 2026, "v26")?.id, "v26");
  // …och när ingen säsong alls täcker idag
  assert.equal(resolveReportSeason([var2026], 33, 2026, "v26")?.id, "v26");
});

test("okänd säsong i URL faller tillbaka på dagens säsong", () => {
  assert.equal(resolveReportSeason([var2026, host2026], 33, 2026, "finns-inte")?.id, "h26");
  // …och ger null när dagens vecka inte heller hör hemma någonstans
  assert.equal(resolveReportSeason([var2026], 33, 2026, "finns-inte"), null);
});

test("gränsveckorna räknas in i säsongen", () => {
  assert.equal(resolveReportSeason([var2026], 5, 2026)?.id, "v26");
  assert.equal(resolveReportSeason([var2026], 26, 2026)?.id, "v26");
  assert.equal(resolveReportSeason([var2026], 4, 2026), null);
  assert.equal(resolveReportSeason([var2026], 27, 2026), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveReportSeason, resolveOverviewPeriod, type SeasonLike, type SeasonRow } from "./season.ts";

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

// --- resolveOverviewPeriod ---

const rowsDesc: SeasonRow[] = [
  { id: "h26", type: "HOST", year: 2026 },
  { id: "v26", type: "VAR", year: 2026 },
  { id: "h25", type: "HOST", year: 2025 },
  { id: "v25", type: "VAR", year: 2025 },
];

test("ingen param alls ger nyaste säsongen (första i listan)", () => {
  const p = resolveOverviewPeriod(rowsDesc);
  assert.equal(p?.kind, "season");
  assert.equal(p && p.kind === "season" && p.id, "h26");
});

test("uttrycklig säsong i URL:en ger den säsongen", () => {
  const p = resolveOverviewPeriod(rowsDesc, "v25");
  assert.equal(p?.kind, "season");
  assert.equal(p && p.kind === "season" && p.id, "v25");
  assert.deepEqual(p?.seasonIds, ["v25"]);
});

test("helår slår ihop Vår och Höst av samma år", () => {
  const p = resolveOverviewPeriod(rowsDesc, "helar:2026");
  assert.equal(p?.kind, "helar");
  assert.equal(p?.label, "Helår 2026");
  // Ordningen spelar ingen roll för anroparen — bara att båda finns med.
  assert.deepEqual(new Set(p?.seasonIds), new Set(["h26", "v26"]));
});

test("helår för ett år med bara en säsong inlagd tar den som finns", () => {
  // T.ex. Höst ännu inte skapad för året — helår blir då samma som den ena säsongen.
  const enSasong: SeasonRow[] = [{ id: "v26", type: "VAR", year: 2026 }];
  const p = resolveOverviewPeriod(enSasong, "helar:2026");
  assert.equal(p?.kind, "helar");
  assert.deepEqual(p?.seasonIds, ["v26"]);
});

test("helår för ett år utan några säsonger alls faller igenom till nyaste", () => {
  const p = resolveOverviewPeriod(rowsDesc, "helar:1999");
  assert.equal(p?.kind, "season");
  assert.equal(p && p.kind === "season" && p.id, "h26");
});

test("okänd säsong i URL faller tillbaka på det ihågkomna valet", () => {
  const p = resolveOverviewPeriod(rowsDesc, "finns-inte", "v25");
  assert.equal(p && p.kind === "season" && p.id, "v25");
});

test("det ihågkomna valet kan självt vara ett helår", () => {
  const p = resolveOverviewPeriod(rowsDesc, undefined, "helar:2025");
  assert.equal(p?.kind, "helar");
  assert.deepEqual(new Set(p?.seasonIds), new Set(["h25", "v25"]));
});

test("URL väger tyngre än det ihågkomna valet", () => {
  const p = resolveOverviewPeriod(rowsDesc, "v26", "helar:2025");
  assert.equal(p && p.kind === "season" && p.id, "v26");
});

test("varken URL, minne eller säsonger ger null", () => {
  assert.equal(resolveOverviewPeriod([]), null);
  assert.equal(resolveOverviewPeriod([], "helar:2026", "v25"), null);
});

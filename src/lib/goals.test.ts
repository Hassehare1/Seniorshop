import { test } from "node:test";
import assert from "node:assert/strict";
import { salesPace, type Actuals, type Goal } from "./goals.ts";

const goal = (over: Partial<Goal> = {}): Goal => ({
  salesTarget: 1_000_000,
  visitsTarget: 85,
  avgPerVisitTarget: 20_000,
  fashionShowsTarget: 30,
  ...over,
});

const actuals = (over: Partial<Actuals> = {}): Actuals => ({
  sales: 0,
  visits: 0,
  avgPerVisit: 0,
  fashionShows: 0,
  ...over,
});

test("räknar på det som återstår, inte på förhållandet mellan målen", () => {
  // 200 000 kr kvar fördelat på 14 besök ≈ 14 286 kr/besök.
  // Den gamla formeln svarade 11 765 (1 000 000 / 85) oavsett läge.
  const p = salesPace(goal(), actuals({ sales: 800_000, visits: 71 }));
  assert.equal(p.kind, "perVisit");
  assert.equal(p.kind === "perVisit" && p.visitsLeft, 14);
  assert.equal(p.kind === "perVisit" && Math.round(p.perVisit), 14_286);
});

test("säger ifrån när säljmålet redan är nått", () => {
  // Det verkliga fallet från produktion: 107 % av målet, men raden påstod
  // ändå att 11 765 kr/besök "krävdes".
  assert.deepEqual(salesPace(goal(), actuals({ sales: 1_071_308, visits: 71 })), { kind: "reached" });
});

test("exakt på målet räknas som nått", () => {
  assert.deepEqual(salesPace(goal(), actuals({ sales: 1_000_000, visits: 71 })), { kind: "reached" });
});

test("ett besök kvar ger visitsLeft 1", () => {
  const p = salesPace(goal(), actuals({ sales: 900_000, visits: 84 }));
  assert.equal(p.kind === "perVisit" && p.visitsLeft, 1);
  assert.equal(p.kind === "perVisit" && Math.round(p.perVisit), 100_000);
});

test("besöksmålet passerat men försäljningen efter — visar gapet, ingen division", () => {
  assert.deepEqual(salesPace(goal(), actuals({ sales: 900_000, visits: 85 })), {
    kind: "visitsExhausted",
    salesLeft: 100_000,
  });
});

test("fler besök än målet ger inte heller någon division med noll eller negativt", () => {
  const p = salesPace(goal(), actuals({ sales: 900_000, visits: 120 }));
  assert.equal(p.kind, "visitsExhausted");
  assert.equal(p.kind === "visitsExhausted" && p.salesLeft, 100_000);
});

test("utan mål finns ingenting att räkna på", () => {
  assert.deepEqual(salesPace(null, actuals()), { kind: "none" });
  assert.deepEqual(salesPace(goal({ salesTarget: 0 }), actuals()), { kind: "none" });
  assert.deepEqual(salesPace(goal({ visitsTarget: 0 }), actuals()), { kind: "none" });
});

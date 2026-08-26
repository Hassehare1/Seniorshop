import test from "node:test";
import assert from "node:assert/strict";
import { getISOWeek, getCurrentWeekAndYear } from "./week.ts";

test("1 jan 2026 (torsdag) är vecka 1", () => {
  assert.equal(getISOWeek(new Date(2026, 0, 1)), 1);
});

test("31 dec 2025 (onsdag) hör till vecka 1 — men i ISO-år 2026", () => {
  const { week, year } = getCurrentWeekAndYear(new Date(2025, 11, 31));
  assert.equal(week, 1);
  assert.equal(year, 2026);
});

test("1 jan 2024 (måndag) är vecka 1", () => {
  assert.equal(getISOWeek(new Date(2024, 0, 1)), 1);
});

test("31 dec 2024 (tisdag) hör till vecka 1 2025 — nyårsveckan räknas framåt", () => {
  const { week, year } = getCurrentWeekAndYear(new Date(2024, 11, 31));
  assert.equal(week, 1);
  assert.equal(year, 2025);
});

test("en vanlig dag mitt i säsongen ger rätt veckonummer", () => {
  assert.equal(getISOWeek(new Date(2026, 7, 26)), 35);
});

test("getCurrentWeekAndYear utan argument använder dagens datum", () => {
  const { week, year } = getCurrentWeekAndYear();
  assert.equal(week, getISOWeek());
  assert.ok(week >= 1 && week <= 53);
  assert.ok(Math.abs(year - new Date().getFullYear()) <= 1);
});

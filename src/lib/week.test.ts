import test from "node:test";
import assert from "node:assert/strict";
import { getISOWeek, getCurrentWeekAndYear, isoWeekMonday } from "./week.ts";

const iso = (d: Date) => d.toISOString().slice(0, 10);

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

/* --- isoWeekMonday: låg otestad i insights/forecast.ts fram till 2026-08-30 --- */

test("isoWeekMonday ger måndagen i veckan", () => {
  // 2026 börjar på en torsdag, så vecka 1 startar måndag 29 december 2025.
  assert.equal(iso(isoWeekMonday(2026, 1)), "2025-12-29");
  // 2024 börjar på en måndag — då sammanfaller vecka 1 med nyårsdagen.
  assert.equal(iso(isoWeekMonday(2024, 1)), "2024-01-01");
  // 2027 börjar på en fredag; ISO-vecka 1 är veckan som innehåller 4 januari.
  assert.equal(iso(isoWeekMonday(2027, 1)), "2027-01-04");
});

test("isoWeekMonday landar alltid på en måndag", () => {
  for (const ar of [2024, 2025, 2026, 2027]) {
    for (const v of [1, 5, 26, 27, 52]) {
      assert.equal(isoWeekMonday(ar, v).getUTCDay(), 1, `${ar} v${v} var inte måndag`);
    }
  }
});

test("isoWeekMonday och isoWeekInfo är varandras motsatser", () => {
  // Den egenskap som faktiskt betyder något: går man fram och tillbaka ska man
  // hamna där man började. Fångar en avvikelse på en dag i endera riktningen.
  for (const ar of [2024, 2025, 2026, 2027]) {
    for (let v = 1; v <= 52; v++) {
      const mandag = isoWeekMonday(ar, v);
      const tillbaka = getCurrentWeekAndYear(
        new Date(mandag.getUTCFullYear(), mandag.getUTCMonth(), mandag.getUTCDate()),
      );
      assert.deepEqual(tillbaka, { week: v, year: ar }, `${ar} v${v} kom inte tillbaka`);
    }
  }
});

test("isoWeekMonday stegar en vecka i taget", () => {
  const v10 = isoWeekMonday(2026, 10).getTime();
  const v11 = isoWeekMonday(2026, 11).getTime();
  assert.equal(v11 - v10, 7 * 86400000, "sju dygn mellan två veckor");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  comparableWeeks,
  elapsedWeeks,
  rankDistricts,
  type DistrictRow,
} from "./compare.ts";

const host = (year: number) => ({ year, weekStart: 27, weekEnd: 52 });

test("gångna veckor: tidigare år är alltid färdigt, kommande har inte börjat", () => {
  assert.equal(elapsedWeeks(host(2025), { week: 33, year: 2026 }), 26);
  assert.equal(elapsedWeeks(host(2027), { week: 33, year: 2026 }), 0);
});

test("gångna veckor under innevarande år styrs av veckan", () => {
  assert.equal(elapsedWeeks(host(2026), { week: 20, year: 2026 }), 0, "före säsongsstart");
  assert.equal(elapsedWeeks(host(2026), { week: 27, year: 2026 }), 1, "första veckan räknas");
  assert.equal(elapsedWeeks(host(2026), { week: 33, year: 2026 }), 7);
  assert.equal(elapsedWeeks(host(2026), { week: 52, year: 2026 }), 26, "sista veckan");
  assert.equal(elapsedWeeks(host(2026), { week: 2, year: 2027 }), 26, "efter säsongsslut");
});

test("en pågående säsong klipper fjolåret vid lika många veckor", () => {
  const ut = comparableWeeks(host(2026), host(2025), { week: 33, year: 2026 });
  assert.equal(ut.veckor, 7);
  assert.equal(ut.pagaende, true);
  assert.deepEqual(ut.innevarande, { from: 27, to: 33 });
  assert.deepEqual(ut.fjolaret, { from: 27, to: 33 });
});

test("en avslutad säsong jämförs i sin helhet", () => {
  const ut = comparableWeeks(host(2026), host(2025), { week: 10, year: 2027 });
  assert.equal(ut.veckor, 26);
  assert.equal(ut.pagaende, false);
  assert.deepEqual(ut.innevarande, { from: 27, to: 52 });
});

test("olika veckospann mellan åren klipps från respektive säsongsstart", () => {
  // Fjolåret började två veckor tidigare — jämförelsen ska ändå bli lika lång.
  const ut = comparableWeeks(host(2026), { year: 2025, weekStart: 25, weekEnd: 50 }, {
    week: 33,
    year: 2026,
  });
  assert.equal(ut.veckor, 7);
  assert.deepEqual(ut.innevarande, { from: 27, to: 33 });
  assert.deepEqual(ut.fjolaret, { from: 25, to: 31 }, "samma antal veckor, inte samma veckonummer");
});

test("en kortare fjolårssäsong kortar båda sidor", () => {
  const ut = comparableWeeks(host(2026), { year: 2025, weekStart: 27, weekEnd: 30 }, {
    week: 40,
    year: 2026,
  });
  assert.equal(ut.veckor, 4, "fjolåret hade bara fyra veckor");
  assert.deepEqual(ut.innevarande, { from: 27, to: 30 });
  assert.deepEqual(ut.fjolaret, { from: 27, to: 30 });
});

test("en säsong som inte börjat ger inget att jämföra", () => {
  const ut = comparableWeeks(host(2026), host(2025), { week: 10, year: 2026 });
  assert.equal(ut.veckor, 0);
  assert.equal(ut.innevarande, null);
  assert.equal(ut.fjolaret, null);
});

const rad = (id: string, sales: number, besok = 10, extra: Partial<DistrictRow> = {}) => ({
  id,
  label: id.toUpperCase(),
  sales,
  besok,
  customers: besok * 5,
  fashionShows: 2,
  ...extra,
});

test("rankas på andel av målet, inte på kronor", () => {
  // d6 säljer mest men har det största målet; d7 överträffar sitt.
  const rows = [rad("d6", 900_000), rad("d7", 500_000)];
  const goals = [
    { districtId: "d6", salesTarget: 1_000_000 },
    { districtId: "d7", salesTarget: 400_000 },
  ];
  const ut = rankDistricts(rows, goals);
  assert.deepEqual(
    ut.map(d => d.label),
    ["D7", "D6"],
  );
  assert.equal(ut[0].goalPercent, 125);
  assert.equal(ut[1].goalPercent, 90);
});

test("distrikt utan mål hamnar sist, oavsett hur mycket de sålt", () => {
  const rows = [rad("utan", 5_000_000), rad("med", 100_000)];
  const goals = [{ districtId: "med", salesTarget: 200_000 }];
  const ut = rankDistricts(rows, goals);
  assert.deepEqual(
    ut.map(d => d.label),
    ["MED", "UTAN"],
  );
  assert.equal(ut[1].goalPercent, null);
  assert.equal(ut[1].salesTarget, null);
});

test("utan mål alls faller listan tillbaka på kronrankning", () => {
  const rows = [rad("a", 100), rad("b", 300), rad("c", 200)];
  assert.deepEqual(
    rankDistricts(rows, []).map(d => d.label),
    ["B", "C", "A"],
  );
});

test("snitt per besök räknas ut, och noll besök ger noll i stället för krasch", () => {
  const ut = rankDistricts([rad("a", 1000, 4), rad("tyst", 0, 0)], []);
  assert.equal(ut.find(d => d.label === "A")!.avgPerVisit, 250);
  assert.equal(ut.find(d => d.label === "TYST")!.avgPerVisit, 0);
});

test("ett tyst distrikt försvinner inte ur listan", () => {
  const ut = rankDistricts([rad("a", 500), rad("tyst", 0, 0)], [
    { districtId: "a", salesTarget: 1000 },
    { districtId: "tyst", salesTarget: 1000 },
  ]);
  assert.equal(ut.length, 2);
  assert.equal(ut[1].label, "TYST");
  assert.equal(ut[1].goalPercent, 0);
});

test("ett mål på noll räknas inte som uppfyllt", () => {
  const ut = rankDistricts([rad("a", 500)], [{ districtId: "a", salesTarget: 0 }]);
  assert.equal(ut[0].goalPercent, null, "division med noll får inte ge Infinity");
});

test("lika resultat sorteras stabilt på namn", () => {
  const rows = [rad("b", 100), rad("a", 100)];
  assert.deepEqual(
    rankDistricts(rows, []).map(d => d.label),
    ["A", "B"],
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { rankDistricts, type DistrictRow } from "./compare.ts";

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

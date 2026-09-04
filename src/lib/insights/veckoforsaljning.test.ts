import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bara,
  forsaljningPerVecka,
  veckoPerDistrikt,
  type VeckoDistrikt,
  type VeckoRapport,
} from "./veckoforsaljning.ts";

const distrikt: VeckoDistrikt[] = [
  { id: "d2", number: 2, name: "S Skåne" },
  { id: "d8", number: 8, name: "Västergötland" },
];

const rapport = (districtId: string, week: number, ...belopp: number[]): VeckoRapport => ({
  districtId,
  week,
  visits: belopp.map(sales => ({ sales })),
});

test("summerar kronor och besök per vecka över hela urvalet", () => {
  const rader = forsaljningPerVecka([
    rapport("d2", 36, 10_000, 5_000),
    rapport("d8", 36, 20_000),
    rapport("d2", 37, 7_000),
  ]);

  assert.deepEqual(rader, [
    { vecka: 36, forsaljning: 35_000, besok: 3 },
    { vecka: 37, forsaljning: 7_000, besok: 1 },
  ]);
});

test("veckorna sorteras på nummer, inte på inkommen ordning", () => {
  const rader = forsaljningPerVecka([
    rapport("d2", 40, 1), rapport("d2", 36, 1), rapport("d2", 38, 1),
  ]);
  assert.deepEqual(rader.map(r => r.vecka), [36, 38, 40]);
});

test("veckor utan rapport fylls INTE ut med nollor", () => {
  // En vecka utan rapport och en vecka med noll kronor är olika saker. Fylls
  // luckorna med nollor går den skillnaden förlorad, och listan blir dubbelt
  // så lång utan att svara på något.
  const rader = forsaljningPerVecka([rapport("d2", 36, 1_000), rapport("d2", 40, 2_000)]);
  assert.deepEqual(rader.map(r => r.vecka), [36, 40]);
});

test("per distrikt: total, antal rapporterade veckor, snitt och bästa vecka", () => {
  const rader = veckoPerDistrikt(
    [rapport("d2", 36, 30_000), rapport("d2", 37, 10_000), rapport("d2", 38, 20_000)],
    distrikt,
  );
  const d2 = rader.find(r => r.districtId === "d2")!;

  assert.equal(d2.total, 60_000);
  assert.equal(d2.rapporteradeVeckor, 3);
  assert.equal(d2.snittPerVecka, 20_000);
  assert.deepEqual(d2.bastaVecka, { vecka: 36, forsaljning: 30_000 });
});

test("snittet räknas på rapporterade veckor, inte på säsongens alla veckor", () => {
  // Två rapporterade veckor av tjugo möjliga ger 15 000 i snitt, inte 1 500.
  // Det andra talet svarar på en fråga ingen ställt.
  const rader = veckoPerDistrikt([rapport("d2", 36, 20_000), rapport("d2", 37, 10_000)], distrikt);
  assert.equal(rader.find(r => r.districtId === "d2")!.snittPerVecka, 15_000);
});

test("flera rapporter samma vecka slås ihop innan bästa veckan avgörs", () => {
  // Annars jämförs delsummor: v37 skulle se ut som 12 000 och förlora mot
  // v36, trots att veckan i själva verket är störst.
  const rader = veckoPerDistrikt(
    [rapport("d2", 36, 15_000), rapport("d2", 37, 12_000), rapport("d2", 37, 9_000)],
    distrikt,
  );
  assert.deepEqual(rader.find(r => r.districtId === "d2")!.bastaVecka, { vecka: 37, forsaljning: 21_000 });
  assert.equal(rader.find(r => r.districtId === "d2")!.rapporteradeVeckor, 2, "två veckor, inte tre rapporter");
});

test("distrikt utan rapporter tas med som nollrad utan bästa vecka", () => {
  const rader = veckoPerDistrikt([rapport("d2", 36, 5_000)], distrikt);

  assert.equal(rader.length, 2);
  const d8 = rader.find(r => r.districtId === "d8")!;
  assert.equal(d8.total, 0);
  assert.equal(d8.snittPerVecka, 0, "noll veckor ger noll, inte division med noll");
  assert.equal(d8.bastaVecka, null);
});

test("rapporter för distrikt utanför urvalet ignoreras", () => {
  const rader = veckoPerDistrikt([rapport("d99", 36, 9_000)], distrikt);
  assert.equal(rader.length, 2);
  assert.equal(rader.reduce((s, r) => s + r.total, 0), 0);
});

test("bara() plockar ut en enskild vecka", () => {
  const alla = [rapport("d2", 36, 1_000), rapport("d8", 36, 2_000), rapport("d2", 37, 3_000)];

  assert.equal(bara(alla, 36).length, 2);
  assert.deepEqual(forsaljningPerVecka(bara(alla, 36)), [{ vecka: 36, forsaljning: 3_000, besok: 2 }]);
  assert.deepEqual(bara(alla, 99), [], "en vecka utan rapporter ger tomt, inte ett fel");
});

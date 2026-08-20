import test from "node:test";
import assert from "node:assert/strict";
import { hasMaterial, matchesMaterialFilter, materialSummary, parseAntal } from "./salesMaterial.ts";

const tom = { postersA3: 0, postersA4: 0, digitalMaterial: false, digitalMaterialNote: null };
const a3 = { ...tom, postersA3: 2 };
const digi = { ...tom, digitalMaterial: true, digitalMaterialNote: "PDF prislista" };

test("saknar material när allt är noll", () => {
  assert.equal(hasMaterial(tom), false);
  assert.equal(matchesMaterialFilter(tom, "none"), true);
  assert.equal(matchesMaterialFilter(a3, "none"), false);
});
test("filtren träffar rätt", () => {
  assert.equal(matchesMaterialFilter(a3, "a3"), true);
  assert.equal(matchesMaterialFilter(a3, "a4"), false);
  assert.equal(matchesMaterialFilter(digi, "digital"), true);
  assert.equal(matchesMaterialFilter(tom, "all"), true);
});
test("sammanfattning läser som på kundkortet", () => {
  assert.equal(materialSummary(tom), "");
  assert.equal(materialSummary({ ...a3, postersA4: 5 }), "2 × A3 · 5 × A4");
  assert.equal(materialSummary(digi), "Digitalt (PDF prislista)");
  assert.equal(materialSummary({ ...digi, digitalMaterialNote: "  " }), "Digitalt");
});
test("antal tolkas defensivt", () => {
  assert.equal(parseAntal("3"), 3);
  assert.equal(parseAntal(""), 0);
  assert.equal(parseAntal(-4), 0);
  assert.equal(parseAntal("abc"), 0);
  assert.equal(parseAntal(2.7), 2);
});

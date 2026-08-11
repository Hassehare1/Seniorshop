import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatPostalCode,
  normalizePostalCode,
  postalCodeDigits,
  validatePostalCode,
} from "./postalCode.ts";

test("tomt fält är giltigt — postnummer är frivilligt", () => {
  assert.equal(validatePostalCode(""), null);
  assert.equal(validatePostalCode("   "), null);
});

test("svenska postnummer godtas med och utan mellanslag", () => {
  assert.equal(validatePostalCode("12345", "SE"), null);
  assert.equal(validatePostalCode("123 45", "SE"), null);
  assert.equal(validatePostalCode(" 123 45 ", "SE"), null);
});

test("fel antal siffror avvisas med tydligt besked", () => {
  assert.equal(validatePostalCode("1234", "SE"), "Postnummer ska vara 5 siffror");
  assert.equal(validatePostalCode("123456", "SE"), "Postnummer ska vara 5 siffror");
});

test("bokstäver försvinner inte tyst i normaliseringen", () => {
  // "12A45" skulle normaliseras till "1245" och annars avvisas på fel grund
  assert.equal(validatePostalCode("12A45", "SE"), "Postnummer får bara innehålla siffror");
  assert.equal(validatePostalCode("SE-12345", "SE"), "Postnummer får bara innehålla siffror");
});

test("regionen styr antalet siffror", () => {
  assert.equal(postalCodeDigits("SE"), 5);
  assert.equal(postalCodeDigits("FI"), 5);
  assert.equal(postalCodeDigits("DK"), 4);
  // Okänd eller saknad region faller tillbaka på svensk längd
  assert.equal(postalCodeDigits(null), 5);
  assert.equal(postalCodeDigits("XX"), 5);

  assert.equal(validatePostalCode("1234", "DK"), null);
  assert.equal(validatePostalCode("12345", "DK"), "Postnummer ska vara 4 siffror");
  assert.equal(validatePostalCode("00100", "FI"), null);
});

test("normalisering behåller bara siffrorna", () => {
  assert.equal(normalizePostalCode("123 45"), "12345");
  assert.equal(normalizePostalCode("123-45"), "12345");
  assert.equal(normalizePostalCode(""), "");
});

test("visningsform: mellanslag bara för svenska femsiffriga", () => {
  assert.equal(formatPostalCode("12345", "SE"), "123 45");
  assert.equal(formatPostalCode("12345", "FI"), "12345");
  assert.equal(formatPostalCode("1234", "DK"), "1234");
  assert.equal(formatPostalCode(null, "SE"), "");
  assert.equal(formatPostalCode("", "SE"), "");
  // Redan formaterat värde ska inte dubbelformateras
  assert.equal(formatPostalCode("123 45", "SE"), "123 45");
});

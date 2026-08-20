import test from "node:test";
import assert from "node:assert/strict";
import { validateVenue } from "./venue.ts";

test("möteslokalen har ett tak på 50 tecken", () => {
  assert.equal(validateVenue("Kuben"), null);
  assert.equal(validateVenue(""), null);
  assert.equal(validateVenue("K".repeat(50)), null);
  assert.equal(validateVenue("  " + "K".repeat(50) + "  "), null);
  assert.ok(validateVenue("K".repeat(51))?.includes("50 tecken"));
});

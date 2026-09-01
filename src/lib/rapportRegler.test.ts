import { test } from "node:test";
import assert from "node:assert/strict";
import { upptagnaKunder, forstaOtillatnaDubbletten } from "./rapportRegler.ts";

const kunder = [
  { id: "boende", type: "ALDREBOENDE" },
  { id: "traff", type: "TRAFFPUNKTER" },
  { id: "hemma", type: "MINDRE_FORSALJNING" },
];
const besok = (...ids: string[]) => ids.map(customerId => ({ customerId }));

test("en vanlig kund på veckan går inte att välja igen", () => {
  const upptagna = upptagnaKunder(besok("boende", ""), 1, kunder);
  assert.deepEqual([...upptagna], ["boende"]);
});

test("mindre försäljning går att välja hur många gånger som helst", () => {
  // Caritas fall: hon hade lagt in ett hemköp på 3 000 kr och behövde lägga
  // in fler från samma vecka.
  const upptagna = upptagnaKunder(besok("hemma", "hemma", ""), 2, kunder);
  assert.equal(upptagna.size, 0);
});

test("raden man står på spärrar inte sig själv", () => {
  // Utan undantaget för det egna indexet vore kunden på raden alltid upptagen,
  // och det gick inte att byta tillbaka till den efter ett felval.
  const upptagna = upptagnaKunder(besok("boende", "traff"), 0, kunder);
  assert.deepEqual([...upptagna], ["traff"]);
});

test("tomma rader spärrar ingenting", () => {
  const upptagna = upptagnaKunder(besok("", "", ""), 0, kunder);
  assert.equal(upptagna.size, 0);
});

test("dubblett av en vanlig kund fångas, och det är rätt kund som pekas ut", () => {
  const träff = forstaOtillatnaDubbletten(besok("traff", "hemma", "traff"), kunder);
  assert.equal(träff?.id, "traff");
});

test("upprepad mindre försäljning är ingen dubblett", () => {
  assert.equal(forstaOtillatnaDubbletten(besok("hemma", "hemma", "hemma"), kunder), null);
});

test("mindre försäljning blandat med vanliga kunder släpps igenom", () => {
  const vecka = besok("boende", "hemma", "traff", "hemma", "hemma");
  assert.equal(forstaOtillatnaDubbletten(vecka, kunder), null);
});

test("en vecka utan dubbletter ger null", () => {
  assert.equal(forstaOtillatnaDubbletten(besok("boende", "traff"), kunder), null);
});

test("okänt kund-id ärver inte undantaget", () => {
  // Faller vi åt fel håll här skulle ett påhittat id kunna upprepas fritt.
  const träff = forstaOtillatnaDubbletten(besok("finns-inte", "finns-inte"), kunder);
  assert.equal(träff?.id, "finns-inte");
});

test("den FÖRSTA otillåtna dubbletten pekas ut, inte den sista", () => {
  const vecka = besok("boende", "traff", "boende", "traff");
  assert.equal(forstaOtillatnaDubbletten(vecka, kunder)?.id, "boende");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINOR_SALES_TYPE,
  tillaterFleraPerVecka,
  customerTypeLabels,
  customerTypeOptions,
} from "./customerTypes.ts";

test("bara mindre försäljning får rapporteras flera gånger samma vecka", () => {
  assert.equal(tillaterFleraPerVecka(MINOR_SALES_TYPE), true);

  // Alla andra typer behåller spärren. Uppräkningen är avsiktligt uttömmande:
  // läggs en ny kundtyp till ska det här testet tvinga fram ett ställningstagande
  // i stället för att den tyst ärver undantaget.
  for (const typ of Object.keys(customerTypeLabels)) {
    if (typ === MINOR_SALES_TYPE) continue;
    assert.equal(tillaterFleraPerVecka(typ), false, `${typ} ska inte tillåta dubbletter`);
  }
});

test("en okänd typ ärver inte undantaget", () => {
  // Kundtypen kommer från databasen. Skulle den innehålla skräp ska spärren
  // gälla — det säkra svaret är att neka, inte att släppa igenom.
  assert.equal(tillaterFleraPerVecka(""), false);
  assert.equal(tillaterFleraPerVecka("NÅGOT_ANNAT"), false);
  assert.equal(tillaterFleraPerVecka("mindre_forsaljning"), false, "gemener är inte samma värde");
});

test("konstanten pekar på en kundtyp som faktiskt finns", () => {
  // Utan det här kan en omdöpt enum göra undantaget till en tyst nullitet:
  // ingen kund matchar längre, spärren gäller alla, och felet syns först när
  // en FT blockeras.
  assert.ok(MINOR_SALES_TYPE in customerTypeLabels);
  assert.ok(customerTypeOptions.some(o => o.value === MINOR_SALES_TYPE));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kundregisterRader,
  kundregisterSumma,
  type RegisterDistrikt,
  type RegisterKund,
} from "./kundregister.ts";

const distrikt: RegisterDistrikt[] = [
  { id: "d2", number: 2, name: "S Skåne" },
  { id: "d12", number: 12, name: "Uppsala" },
];

const kund = (over: Partial<RegisterKund> = {}): RegisterKund => ({
  districtId: "d2",
  active: true,
  postalCode: null,
  city: null,
  phone: null,
  contactPerson: null,
  postersA3: 0,
  postersA4: 0,
  digitalMaterial: false,
  ...over,
});

test("räknar med och utan postnummer, och andelen på distriktets kunder", () => {
  const rader = kundregisterRader(
    [kund({ postalCode: "27231" }), kund({ postalCode: "24745" }), kund(), kund()],
    distrikt,
  );
  const d2 = rader.find(r => r.districtId === "d2")!;

  assert.equal(d2.antal, 4);
  assert.equal(d2.medPostnummer, 2);
  assert.equal(d2.utanPostnummer, 2);
  assert.equal(d2.andelPostnummer, 50);
});

test("tomt och blanktecken räknas som saknat, inte som ifyllt", () => {
  // Importen och formulären kan lämna efter sig tomma strängar. Räknas de som
  // ifyllda ser registret bättre ut än det är, vilket är det enda felet som
  // gör hela verktyget skadligt i stället för bara ofullständigt.
  const rader = kundregisterRader(
    [kund({ postalCode: "" }), kund({ postalCode: "   " }), kund({ postalCode: "27231" })],
    distrikt,
  );
  const d2 = rader.find(r => r.districtId === "d2")!;

  assert.equal(d2.medPostnummer, 1);
  assert.equal(d2.utanPostnummer, 2);
});

test("säljmaterial räknas när något av de tre finns", () => {
  const rader = kundregisterRader(
    [
      kund({ postersA3: 2 }),
      kund({ postersA4: 5 }),
      kund({ digitalMaterial: true }),
      kund(),
    ],
    distrikt,
  );
  assert.equal(rader.find(r => r.districtId === "d2")!.medSaljmaterial, 3);
});

test("inaktiva kunder räknas i antalet men inte som aktiva", () => {
  const rader = kundregisterRader(
    [kund(), kund({ active: false }), kund({ active: false })],
    distrikt,
  );
  const d2 = rader.find(r => r.districtId === "d2")!;

  assert.equal(d2.antal, 3);
  assert.equal(d2.aktiva, 1);
});

test("distrikt utan kunder tas med som nollrad", () => {
  // Ett distrikt som inte lagt in någonting är det mest intressanta svaret på
  // frågan "vem har inte kommit igång". Utelämnas raden ser det ut som att
  // distriktet inte finns.
  const rader = kundregisterRader([kund()], distrikt);

  assert.equal(rader.length, 2);
  const d12 = rader.find(r => r.districtId === "d12")!;
  assert.equal(d12.antal, 0);
  assert.equal(d12.andelPostnummer, 0, "noll kunder ger noll procent, inte division med noll");
});

test("raderna sorteras på distriktsnummer, inte på inkommen ordning", () => {
  const blandat: RegisterDistrikt[] = [
    { id: "d13", number: 13, name: "Dalarna" },
    { id: "d2", number: 2, name: "S Skåne" },
    { id: "d8", number: 8, name: "Västergötland" },
  ];
  assert.deepEqual(kundregisterRader([], blandat).map(r => r.number), [2, 8, 13]);
});

test("kunder i distrikt utanför urvalet ignoreras i stället för att bli namnlösa rader", () => {
  const rader = kundregisterRader([kund({ districtId: "d99", postalCode: "12345" })], distrikt);

  assert.equal(rader.length, 2);
  assert.equal(kundregisterSumma(rader).antal, 0);
});

test("summans andel räknas på summorna, inte som medelvärde av distriktens andelar", () => {
  // d2: 1 av 100 har postnummer (1 %). d12: 1 av 1 (100 %). Medelvärdet av
  // andelarna är 50 % — men rätt svar är 2 av 101, alltså 2 %.
  const kunder = [
    ...Array.from({ length: 99 }, () => kund()),
    kund({ postalCode: "27231" }),
    kund({ districtId: "d12", postalCode: "75440" }),
  ];
  const summa = kundregisterSumma(kundregisterRader(kunder, distrikt));

  assert.equal(summa.antal, 101);
  assert.equal(summa.medPostnummer, 2);
  assert.equal(summa.andelPostnummer, 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import { findLayout } from "./importLayout.ts";

/** Rubrikraden som den ser ut i FT:s fil våren 2025 — tio nya kategorier i E–N,
 *  de fem gamla kvar i O–S, och metadata längre ut. */
const nyRubrik = [
  "Distrikt", "Vecka", "Antal", "Namn på besök",
  "Äldreboende", "Träffpunkter", "Pensionärsförening", "Förening Stöd & Hälsoverksamhet",
  "Övriga föreningar", "Församlingshem arrangerat av kyrkan", "55+", "Eget arrangemang",
  "Campingplatser", "Mindre försäljning",
  "Vårdhem", "Förening", "Träffpunkt", "Boende +55", "Övrigt",
  "Modevisning", "Antal kunder", "Avgift", "Marknadsföring", "Marknadsföring totalt",
  "Total försäljning", "Total marknadsföring", "Att betala ink moms", "Kommentar",
];

/** Gamla formatet: fem kategorier direkt efter namnet. */
const gammalRubrik = [
  "Distrikt", "Vecka", "Antal", "Namn på besök",
  "Vårdhem", "Förening", "Träffpunkt", "Boende +55", "Övrigt",
  "Modevisning", "Antal kunder",
];

test("hittar rubrikraden även när den inte är första raden", () => {
  const rows = [
    ["Rapport", null, null],
    [null, null, null],
    ["Försäljning ink moms", 67507, null],
    nyRubrik,
    [2, 10, 1, "Villa Vikhem"],
  ];
  const l = findLayout(rows);
  assert.ok(l);
  assert.equal(l.headerRow, 3);
});

test("nya formatet: vecka, namn och metadata hittas på rubrik, inte position", () => {
  const l = findLayout([nyRubrik]);
  assert.ok(l);
  assert.equal(l.week, 1, "Vecka i B");
  assert.equal(l.name, 3, "Namn på besök i D");
  assert.equal(l.fashionShow, 19, "Modevisning i T");
  assert.equal(l.customers, 20, "Antal kunder i U");
  assert.equal(l.comment, 27, "Kommentar i AB");
});

test("nya kategorierna läses från E och framåt", () => {
  const l = findLayout([nyRubrik]);
  assert.ok(l);
  const första = l.typeCols.slice(0, 10);
  assert.deepEqual(
    första.map(t => t.col),
    [4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    "E–N",
  );
  assert.deepEqual(första.map(t => t.type), [
    "ALDREBOENDE", "TRAFFPUNKTER", "PENSIONARSFORENING", "FORENING_STOD_HALSA",
    "OVRIGA_FORENINGAR", "FORSAMLINGSHEM", "PLUS_55", "EGET_ARRANGEMANG",
    "CAMPINGPLATSER", "MINDRE_FORSALJNING",
  ]);
});

test("gamla kolumnerna känns igen och mappas till de nya kategorierna", () => {
  const l = findLayout([gammalRubrik]);
  assert.ok(l);
  assert.deepEqual(l.typeCols, [
    { col: 4, type: "ALDREBOENDE" },
    { col: 5, type: "OVRIGA_FORENINGAR" },
    { col: 6, type: "TRAFFPUNKTER" },
    { col: 7, type: "PLUS_55" },
    { col: 8, type: "OVRIGT" },
  ]);
});

test("en fil mitt i övergången låter den nya uppsättningen vinna", () => {
  // Båda uppsättningarna finns; typeCols är vänster-till-höger, så den nya
  // kommer först och används när flera kolumner är ifyllda på samma rad.
  const l = findLayout([nyRubrik]);
  assert.ok(l);
  assert.equal(l.typeCols[0].col, 4);
  assert.equal(l.typeCols[0].type, "ALDREBOENDE");
  assert.equal(l.typeCols.length, 15, "tio nya plus fem gamla");
});

test("stavfelet Pensionärsförning i tidiga filer läses ändå rätt", () => {
  const l = findLayout([["Vecka", "Namn på besök", "Äldreboende", "Pensionärsförning", "55+"]]);
  assert.ok(l);
  assert.equal(l.typeCols.find(t => t.col === 3)?.type, "PENSIONARSFORENING");
});

test("rubriker matchas oberoende av versaler och extra blanksteg", () => {
  const l = findLayout([["  VECKA ", "Namn på besök", "ÄLDREBOENDE", "  Träffpunkter", "55+"]]);
  assert.ok(l);
  assert.equal(l.week, 0);
  assert.equal(l.typeCols.length, 3);
});

test("en fil utan igenkända kategorier ger null i stället för gissning", () => {
  assert.equal(findLayout([["Distrikt", "Vecka", "Namn på besök", "Summa"]]), null);
});

test("kategorier men utan vecka eller namn ger null", () => {
  assert.equal(findLayout([["Äldreboende", "Träffpunkter", "55+"]]), null, "vecka och namn saknas");
});

test("metadata som saknas blir null, inte en felgissad kolumn", () => {
  const l = findLayout([["Vecka", "Namn på besök", "Äldreboende", "Träffpunkter", "55+"]]);
  assert.ok(l);
  assert.equal(l.fashionShow, null);
  assert.equal(l.customers, null);
  assert.equal(l.comment, null);
});

test("kolumnen 'Antal' förväxlas inte med 'Antal kunder'", () => {
  const l = findLayout([["Vecka", "Antal", "Namn på besök", "Äldreboende", "Träffpunkter", "55+", "Antal kunder"]]);
  assert.ok(l);
  assert.equal(l.customers, 6);
});

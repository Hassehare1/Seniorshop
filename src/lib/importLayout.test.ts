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

/** Formatet FT går över till: bara de tio nya kategorierna, de gamla fem borttagna.
 *  Bekräftat av Johan 2026-08-18 — O–S plockas bort innan nästa import. */
const framtidaRubrik = [
  "Distrikt", "Vecka", "Antal", "Namn på besök",
  "Äldreboende", "Träffpunkter", "Pensionärsförening", "Förening Stöd & Hälsoverksamhet",
  "Övriga föreningar", "Församlingshem arrangerat av kyrkan", "55+", "Eget arrangemang",
  "Campingplatser", "Mindre försäljning",
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
    { col: 8, type: "MINDRE_FORSALJNING" },
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

test("bekräftat framtida format: tio kategorier, de gamla borttagna", () => {
  const l = findLayout([framtidaRubrik]);
  assert.ok(l);
  assert.equal(l.typeCols.length, 10, "exakt de tio — ingen gammal kolumn kvar");
  assert.deepEqual(l.typeCols.map(t => t.col), [4, 5, 6, 7, 8, 9, 10, 11, 12, 13], "E–N");
  assert.deepEqual(l.typeCols.map(t => t.type), [
    "ALDREBOENDE", "TRAFFPUNKTER", "PENSIONARSFORENING", "FORENING_STOD_HALSA",
    "OVRIGA_FORENINGAR", "FORSAMLINGSHEM", "PLUS_55", "EGET_ARRANGEMANG",
    "CAMPINGPLATSER", "MINDRE_FORSALJNING",
  ]);
});

test("när de gamla kolumnerna tas bort flyttar metadata med sig", () => {
  // Modevisning låg i T när båda uppsättningarna fanns; utan de fem gamla
  // hamnar den i O. Rubrikmatchningen ska följa med utan att någon rör koden.
  const l = findLayout([framtidaRubrik]);
  assert.ok(l);
  assert.equal(l.fashionShow, 14, "Modevisning i O");
  assert.equal(l.customers, 15, "Antal kunder i P");
  assert.equal(l.comment, 22, "Kommentar i W");
  assert.equal(l.week, 1);
  assert.equal(l.name, 3);
});

test("en rad vars enda värde låg i borttagna Övrigt räknas inte som kategori", () => {
  // Övrigt finns inte bland de tio. En rad som bara hade ett tal där får ingen
  // kategori och hoppas över med varning i importen — högljutt, inte tyst.
  const l = findLayout([framtidaRubrik]);
  assert.ok(l);
  assert.equal(l.typeCols.some(t => t.type === "OVRIGT"), false);
});

test("gamla filers Övrigt-kolumn läses som Mindre försäljning", () => {
  // Övrigt finns inte bland FT:s tio. Johans beslut: de hör dit.
  const l = findLayout([["Vecka", "Namn på besök", "Vårdhem", "Träffpunkt", "Övrigt"]]);
  assert.ok(l);
  assert.equal(l.typeCols.find(t => t.col === 4)?.type, "MINDRE_FORSALJNING");
  assert.equal(l.typeCols.some(t => t.type === "OVRIGT"), false, "inget hamnar i OVRIGT längre");
});

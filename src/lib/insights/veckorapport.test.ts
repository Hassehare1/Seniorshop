import { test } from "node:test";
import assert from "node:assert/strict";
import { veckorapportRader, veckorapportSumma, type VeckoDistrict, type VeckoReport } from "./veckorapport.ts";

const distrikt: VeckoDistrict[] = [
  { id: "d2", number: 2, name: "S Skåne" },
  { id: "d8", number: 8, name: "Västergötland" },
];

const besok = (sales: number, kunder = 20, customerType = "TRAFFPUNKTER") => ({
  customerType,
  sales,
  numberOfCustomers: kunder,
});

test("mindre försäljning är borta ur alla fyra kolumnerna", () => {
  const reports: VeckoReport[] = [
    {
      districtId: "d2",
      visits: [besok(20_000, 30), besok(30_000, 40), besok(2_000, 3, "MINDRE_FORSALJNING")],
    },
  ];
  const [d2] = veckorapportRader(reports, distrikt);

  assert.equal(d2.sales, 50_000);
  assert.equal(d2.besok, 2);
  assert.equal(d2.kunder, 70, "besökarna på lagerförsäljningen ska inte heller räknas");
  assert.equal(d2.snitt, 25_000);
});

test("kolumnerna går ihop: omsättning delad med besök ÄR snittet", () => {
  // Det är skillnaden mot resten av portalen, där omsättning och besök är
  // totaler och bara snittet tvättas. Går den här likheten sönder har någon
  // blandat ihop de två vyerna.
  const reports: VeckoReport[] = [
    { districtId: "d2", visits: [besok(17_000), besok(9_500), besok(4_100, 5, "MINDRE_FORSALJNING")] },
    { districtId: "d8", visits: [besok(31_000), besok(12_250)] },
  ];
  const rader = veckorapportRader(reports, distrikt);
  const summa = veckorapportSumma(rader);

  for (const r of rader) assert.equal(r.snitt, r.sales / r.besok);
  assert.equal(summa.snitt, summa.sales / summa.besok);
});

test("det borttagna redovisas separat, och totalen finns kvar", () => {
  const reports: VeckoReport[] = [
    { districtId: "d2", visits: [besok(40_000), besok(6_000, 4, "MINDRE_FORSALJNING")] },
  ];
  const [d2] = veckorapportRader(reports, distrikt);

  assert.equal(d2.bortSales, 6_000);
  assert.equal(d2.bortKunder, 4, "kunderna på raden, inte antalet rader");
  assert.equal(d2.totalSales, 46_000, "portalens egen siffra ska gå att visa bredvid");
  assert.equal(d2.totalBesok, 2);
});

test("distrikt utan rapport tas med som nollrad", () => {
  const rader = veckorapportRader([{ districtId: "d2", visits: [besok(1_000)] }], distrikt);

  assert.equal(rader.length, 2);
  const d8 = rader.find(r => r.districtId === "d8")!;
  assert.equal(d8.besok, 0);
  assert.equal(d8.snitt, 0, "noll besök ger noll, inte division med noll");
});

test("raderna sorteras på distriktsnummer, inte på namn eller inkommen ordning", () => {
  const blandat: VeckoDistrict[] = [
    { id: "d12", number: 12, name: "Uppsala" },
    { id: "d2", number: 2, name: "S Skåne" },
    { id: "d8", number: 8, name: "Västergötland" },
  ];
  assert.deepEqual(
    veckorapportRader([], blandat).map(r => r.number),
    [2, 8, 12],
  );
});

test("en vecka där ALLT är mindre försäljning ger noll besök och noll snitt", () => {
  // Hände på riktigt: D12 vecka 14 vår 2026 var sex lagerförsäljningar och
  // ingenting annat. I Anders eget ark blev besökscellen tom medan kronorna
  // låg kvar i summan, så veckans snitt blev för högt.
  const reports: VeckoReport[] = [
    { districtId: "d2", visits: [besok(4_000, 2, "MINDRE_FORSALJNING"), besok(3_000, 1, "MINDRE_FORSALJNING")] },
  ];
  const [d2] = veckorapportRader(reports, distrikt);

  assert.equal(d2.sales, 0);
  assert.equal(d2.besok, 0);
  assert.equal(d2.snitt, 0);
  assert.equal(d2.bortSales, 7_000);
  assert.equal(d2.bortKunder, 3, "två plus en kund, inte två rader");
  assert.equal(d2.totalSales, 7_000);
});

test("summans snitt räknas på summorna, inte som medelvärde av distriktens snitt", () => {
  // d2: 100 000 på 1 besök, d8: 40 000 på 4. Medelvärdet av snitten är
  // 55 000 kr — men rätt svar är 140 000 / 5 = 28 000.
  const reports: VeckoReport[] = [
    { districtId: "d2", visits: [besok(100_000)] },
    { districtId: "d8", visits: [besok(10_000), besok(10_000), besok(10_000), besok(10_000)] },
  ];
  const summa = veckorapportSumma(veckorapportRader(reports, distrikt));

  assert.equal(summa.snitt, 28_000);
});

test("rapporter för distrikt utanför urvalet ignoreras i stället för att bli namnlösa rader", () => {
  const rader = veckorapportRader([{ districtId: "d99", visits: [besok(9_000)] }], distrikt);

  assert.equal(rader.length, 2);
  assert.equal(veckorapportSumma(rader).sales, 0);
});

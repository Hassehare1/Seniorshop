import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINOR_SALES_TYPE,
  aggregateByDistrict,
  aggregateByType,
  avgPerVisitExclMinor,
  goalActualsFrom,
  uniqueWeeks,
  type ReportInput,
  type VisitInput,
} from "./aggregate.ts";

const visit = (over: Partial<VisitInput> = {}): VisitInput => ({
  customerType: "TRAFFPUNKTER",
  sales: 1000,
  ftFee: 75,
  mfFee: 10,
  numberOfCustomers: 5,
  isFashionShow: false,
  isHangerShow: false,
  ...over,
});

const report = (over: Partial<ReportInput> = {}): ReportInput => ({
  week: 10,
  districtId: "d6",
  districtNumber: 6,
  districtName: "Småland",
  visits: [],
  ...over,
});

test("unika veckor dedupliceras och sorteras", () => {
  // Flera distrikt rapporterar samma vecka — utan dedup dubbleras x-axeln
  const reports = [
    report({ week: 12 }),
    report({ week: 10, districtId: "d7" }),
    report({ week: 12, districtId: "d7" }),
    report({ week: 11 }),
  ];
  assert.deepEqual(uniqueWeeks(reports), [10, 11, 12]);
  assert.deepEqual(uniqueWeeks([]), []);
});

test("summerar per kundtyp", () => {
  const reports = [
    report({ visits: [visit(), visit({ customerType: "ALDREBOENDE", sales: 500, numberOfCustomers: 3 })] }),
  ];
  const { byType } = aggregateByType(reports, [10]);

  const traff = byType.find(t => t.type === "TRAFFPUNKTER")!;
  assert.equal(traff.sales, 1000);
  assert.equal(traff.besok, 1);
  assert.equal(traff.customers, 5);
  assert.equal(traff.ftFee, 75);
  assert.equal(traff.mfFee, 10);

  const vard = byType.find(t => t.type === "ALDREBOENDE")!;
  assert.equal(vard.sales, 500);
  assert.equal(vard.customers, 3);
});

test("kundtyper utan besök utelämnas, och ordningen är den fasta", () => {
  const reports = [report({ visits: [visit({ customerType: "ALDREBOENDE" }), visit({ customerType: "OVRIGA_FORENINGAR" })] })];
  const { byType } = aggregateByType(reports, [10]);
  assert.deepEqual(byType.map(t => t.type), ["ALDREBOENDE", "OVRIGA_FORENINGAR"]);
});

test("okänd kundtyp hamnar under OVRIGT i stället för att tappas", () => {
  const reports = [report({ visits: [visit({ customerType: "FINNS_INTE", sales: 700 })] })];
  const { byType, showType } = aggregateByType(reports, [10]);
  const ovrigt = byType.find(t => t.type === "OVRIGT")!;
  assert.equal(ovrigt.sales, 700);
  assert.equal(showType.OVRIGT.ovriga.sales, 700);
});

test("veckofördelningen hamnar i rätt fack", () => {
  const reports = [
    report({ week: 10, visits: [visit({ sales: 100 })] }),
    report({ week: 12, visits: [visit({ sales: 300 })] }),
  ];
  const weeks = [10, 11, 12];
  const { byType } = aggregateByType(reports, weeks);
  assert.deepEqual(byType[0].weekly, [100, 0, 300]);
});

test("veckor utanför urvalet räknas i totalen men inte i veckofördelningen", () => {
  const reports = [
    report({ week: 10, visits: [visit({ sales: 100 })] }),
    report({ week: 99, visits: [visit({ sales: 400 })] }),
  ];
  const { byType } = aggregateByType(reports, [10]);
  assert.equal(byType[0].sales, 500);
  assert.deepEqual(byType[0].weekly, [100]);
});

test("visningstyperna summerar till totalen utan dubbelräkning", () => {
  const reports = [
    report({
      visits: [
        visit({ sales: 1000, isFashionShow: true }),
        visit({ sales: 200, isHangerShow: true }),
        visit({ sales: 300 }),
      ],
    }),
  ];
  const { byType, showType } = aggregateByType(reports, [10]);
  const s = showType.TRAFFPUNKTER;

  assert.equal(s.modevisning.sales, 1000);
  assert.equal(s.galge.sales, 200);
  assert.equal(s.ovriga.sales, 300);
  assert.equal(s.modevisning.sales + s.galge.sales + s.ovriga.sales, byType[0].sales);
  assert.equal(s.modevisning.besok + s.galge.besok + s.ovriga.besok, byType[0].besok);
});

test("modevisning vinner över galge när båda är satta", () => {
  // Formulär och server spärrar kombinationen, men regeln ska ändå vara entydig
  const reports = [report({ visits: [visit({ sales: 900, isFashionShow: true, isHangerShow: true })] })];
  const { byType, showType } = aggregateByType(reports, [10]);
  assert.equal(showType.TRAFFPUNKTER.modevisning.sales, 900);
  assert.equal(showType.TRAFFPUNKTER.galge.sales, 0);
  // Räknarna för respektive visningstyp är däremot oberoende
  assert.equal(byType[0].fashionShows, 1);
  assert.equal(byType[0].hangerShows, 1);
});

test("summerar per distrikt och sorterar på etikett", () => {
  const reports = [
    report({ districtId: "d7", districtNumber: 7, districtName: "Halland", visits: [visit({ sales: 200 })] }),
    report({ districtId: "d6", visits: [visit({ sales: 100 })] }),
    report({ districtId: "d6", week: 11, visits: [visit({ sales: 50 })] }),
  ];
  const byDistrict = aggregateByDistrict(reports, [10, 11]);

  assert.deepEqual(byDistrict.map(d => d.label), ["D6 – Småland", "D7 – Halland"]);
  assert.equal(byDistrict[0].sales, 150);
  assert.equal(byDistrict[0].besok, 2);
  assert.deepEqual(byDistrict[0].weekly, [100, 50]);
  assert.equal(byDistrict[1].sales, 200);
});

test("målutfall räknas ur kundtypsaggregatet", () => {
  const reports = [
    report({ visits: [visit({ sales: 1000, isFashionShow: true }), visit({ sales: 500 })] }),
    report({ visits: [visit({ sales: 300, customerType: "ALDREBOENDE" })] }),
  ];
  const { byType } = aggregateByType(reports, [10]);
  const actuals = goalActualsFrom(byType);

  assert.equal(actuals.sales, 1800);
  assert.equal(actuals.visits, 3);
  assert.equal(actuals.avgPerVisit, 600);
  assert.equal(actuals.fashionShows, 1);
});

test("inga besök ger noll i snitt i stället för division med noll", () => {
  const actuals = goalActualsFrom([]);
  assert.equal(actuals.sales, 0);
  assert.equal(actuals.visits, 0);
  assert.equal(actuals.avgPerVisit, 0);
});

test("mindre försäljning räknas bort ur snittet men inte ur omsättning och besök", () => {
  // Två riktiga besök à 20 000 kr och en lagerförsäljning på 2 000 kr. Utan
  // tvätten blir snittet 14 000 kr — lagerförsäljningen drar ned det med 30 %.
  const reports = [
    report({
      visits: [
        visit({ sales: 20_000 }),
        visit({ sales: 20_000 }),
        visit({ sales: 2_000, customerType: MINOR_SALES_TYPE }),
      ],
    }),
  ];
  const { byType } = aggregateByType(reports, [10]);
  const actuals = goalActualsFrom(byType);

  assert.equal(actuals.sales, 42_000, "omsättningen är total — det är den som faktureras");
  assert.equal(actuals.visits, 3, "besöken är alla registrerade besök");
  assert.equal(actuals.avgPerVisit, 20_000, "snittet räknar bara de två riktiga besöken");
  assert.deepEqual(actuals.minor, { sales: 2_000, besok: 1 }, "det borträknade ska gå att skriva ut");
});

test("ett urval som bara är mindre försäljning ger noll i snitt, inte kvarvarande omsättning delad med noll", () => {
  // Nämnaren blir tom. Faller vakten bort ger uttrycket Infinity, som formateras
  // till "∞ kr" i gränssnittet i stället för att utebli.
  const reports = [report({ visits: [visit({ sales: 5_000, customerType: MINOR_SALES_TYPE })] })];
  const { byType } = aggregateByType(reports, [10]);
  const actuals = goalActualsFrom(byType);

  assert.equal(actuals.sales, 5_000);
  assert.equal(actuals.visits, 1);
  assert.equal(actuals.avgPerVisit, 0);
});

test("distriktsaggregatet bär med sig mindre försäljning så snittet går att tvätta per distrikt", () => {
  // DistAgg har ingen typdimension — utan det här fältet skulle admins
  // måltabell räkna snittet på ett annat sätt än FT:s eget målkort.
  const reports = [
    report({
      visits: [
        visit({ sales: 30_000 }),
        visit({ sales: 3_000, customerType: MINOR_SALES_TYPE }),
      ],
    }),
  ];
  const [d] = aggregateByDistrict(reports, [10]);

  assert.equal(d.sales, 33_000);
  assert.equal(d.besok, 2);
  assert.deepEqual(d.minor, { sales: 3_000, besok: 1 });
  assert.equal(avgPerVisitExclMinor(d.sales, d.besok, d.minor), 30_000);
});

test("samma tal oavsett om det räknas ur kundtyps- eller distriktsaggregatet", () => {
  // De två vägarna leder till olika kort i gränssnittet (FT:s målkort respektive
  // admins översikt). Glider de isär ser en FT ett annat snitt än sin chef.
  const reports = [
    report({ visits: [visit({ sales: 18_000 }), visit({ sales: 1_500, customerType: MINOR_SALES_TYPE })] }),
    report({ week: 11, visits: [visit({ sales: 22_000, customerType: "ALDREBOENDE" })] }),
  ];
  const weeks = [10, 11];
  const { byType } = aggregateByType(reports, weeks);
  const [d] = aggregateByDistrict(reports, weeks);

  assert.equal(
    goalActualsFrom(byType).avgPerVisit,
    avgPerVisitExclMinor(d.sales, d.besok, d.minor),
  );
});

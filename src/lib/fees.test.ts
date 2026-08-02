import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFees, formatOre, money, type FeeConfig } from "./fees.ts";

const config: FeeConfig = {
  ftFeePercent: 0.075,
  mfFeePercent: 0.01,
  mfFeeCap: 6000, // ink moms
  vatMultiplier: 1.25,
};

// Taket lagras ink moms men MF ackumuleras ex moms — det ex moms-tak
// som beräkningen faktiskt jämför mot (6000 / 1,25 = 4800).
const mfCapExVat = 4800;

// Exakt jämförelse — pengar räknas i Decimal, så inga toleranser behövs.
function exact(actual: { toString(): string }, expected: string | number, msg?: string) {
  assert.equal(
    money(actual as never).toFixed(2),
    money(expected).toFixed(2),
    `${msg ?? ""} förväntat ${expected}, fick ${actual.toString()}`
  );
}

test("noll försäljning ger noll avgifter", () => {
  const r = calculateFees(0, 0, config);
  exact(r.ftFee, 0);
  exact(r.mfFee, 0);
  exact(r.totalToPay, 0);
  exact(r.mfFeeAccumulated, 0);
});

test("grundberäkning under taket (12 500 ink. moms)", () => {
  const r = calculateFees(12500, 0, config);
  // 12500 / 1.25 = 10000 ex moms → FT 7,5% = 750, MF 1% = 100
  exact(r.ftFee, 750, "FT-avgift");
  exact(r.mfFee, 100, "MF-avgift");
  exact(r.mfFeeAccumulated, 100, "MF ackumulerat");
  // moms = (750+100) * 0.25 = 212,5 → totalt = 1062,5
  exact(r.vat, 212.5, "moms");
  exact(r.totalToPay, 1062.5, "att betala");
});

test("MF kapas delvis när ackumulerat närmar sig taket", () => {
  // 50 kr kvar till taket, men MF-avgiften skulle bli 100
  const r = calculateFees(12500, mfCapExVat - 50, config);
  exact(r.mfFee, 50, "MF kapad till återstående utrymme");
  exact(r.mfFeeAccumulated, mfCapExVat, "ackumulerat når exakt taket");
  exact(r.ftFee, 750, "FT-avgift opåverkad av taket");
  // moms = (750+50) * 0.25 = 200 → totalt = 1000
  exact(r.totalToPay, 1000, "att betala");
});

test("MF blir noll när taket redan är nått", () => {
  const r = calculateFees(12500, mfCapExVat, config);
  exact(r.mfFee, 0, "ingen MF-avgift över taket");
  exact(r.mfFeeAccumulated, mfCapExVat, "ackumulerat oförändrat vid taket");
  exact(r.ftFee, 750, "FT-avgift fortsätter alltid");
  // moms = 750 * 0.25 = 187,5 → totalt = 937,5
  exact(r.totalToPay, 937.5, "att betala (endast FT + moms)");
});

test("MF överskrider aldrig taket även vid stor försäljning", () => {
  const r = calculateFees(10_000_000, 0, config);
  exact(r.mfFee, mfCapExVat, "MF kapas till taket");
  exact(r.mfFeeAccumulated, mfCapExVat, "ackumulerat = taket");
});

test("avgifter avrundas till hela ören", () => {
  // 1000,07 ink moms → ex moms 800,056 → FT 7,5% = 60,0042 → 60,00
  const r = calculateFees("1000.07", 0, config);
  assert.equal(r.ftFee.toFixed(2), "60.00", "FT-avgift avrundad till öre");
  assert.equal(r.mfFee.toFixed(2), "8.00", "MF-avgift avrundad till öre");
  // Inga svansar av typen 60.00420000000001
  assert.ok(!r.ftFee.toString().includes("0000"), "ingen flyttalssvans");
});

// Regression: i flyttal driver upprepad ackumulering iväg från taket och gör
// lagrade belopp omöjliga att jämföra exakt mot omräknade (api/reports
// jämför just så). Decimal håller summan exakt.
test("ackumulering över många besök landar exakt på taket", () => {
  let acc = money(0);
  // 480 besök à 1250 ink moms → MF 10 kr/besök ex moms = exakt 4800 = taket
  for (let i = 0; i < 480; i++) {
    const r = calculateFees(1250, acc, config);
    acc = r.mfFeeAccumulated;
  }
  assert.equal(acc.toFixed(2), "4800.00", "ackumulerat exakt på taket utan drift");

  // Nästa besök får ingen MF alls
  const nextVisit = calculateFees(1250, acc, config);
  exact(nextVisit.mfFee, 0, "MF slut efter taket");
});

test("formatOre ger exakta öresträngar för export", () => {
  assert.equal(formatOre(1062.5), "1062.50");
  assert.equal(formatOre("0.1"), "0.10");
  // 0.1 + 0.2 i flyttal = 0.30000000000000004; Decimal ger 0.30
  assert.equal(formatOre(money("0.1").plus(money("0.2"))), "0.30");
});

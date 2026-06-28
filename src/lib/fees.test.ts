import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFees, type FeeConfig } from "./fees.ts";

const config: FeeConfig = {
  ftFeePercent: 0.075,
  mfFeePercent: 0.01,
  mfFeeCap: 6000, // ink moms
  vatMultiplier: 1.25,
};

// Taket lagras ink moms men MF ackumuleras ex moms — det ex moms-tak
// som beräkningen faktiskt jämför mot (6000 / 1,25 = 4800).
const mfCapExVat = config.mfFeeCap / config.vatMultiplier;

// Approximativ jämförelse (flyttal)
function close(actual: number, expected: number, msg?: string) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${msg ?? ""} förväntat ${expected}, fick ${actual}`);
}

test("noll försäljning ger noll avgifter", () => {
  const r = calculateFees(0, 0, config);
  close(r.ftFee, 0);
  close(r.mfFee, 0);
  close(r.totalToPay, 0);
  close(r.mfFeeAccumulated, 0);
});

test("grundberäkning under taket (12 500 ink. moms)", () => {
  const r = calculateFees(12500, 0, config);
  // 12500 / 1.25 = 10000 ex moms → FT 7,5% = 750, MF 1% = 100
  close(r.ftFee, 750, "FT-avgift");
  close(r.mfFee, 100, "MF-avgift");
  close(r.mfFeeAccumulated, 100, "MF ackumulerat");
  // moms = (750+100) * 0.25 = 212,5 → totalt = 1062,5
  close(r.vat, 212.5, "moms");
  close(r.totalToPay, 1062.5, "att betala");
});

test("MF kapas delvis när ackumulerat närmar sig taket", () => {
  // 50 kr kvar till taket, men MF-avgiften skulle bli 100
  const accumulated = mfCapExVat - 50;
  const r = calculateFees(12500, accumulated, config);
  close(r.mfFee, 50, "MF kapad till återstående utrymme");
  close(r.mfFeeAccumulated, mfCapExVat, "ackumulerat når exakt taket");
  close(r.ftFee, 750, "FT-avgift opåverkad av taket");
  // moms = (750+50) * 0.25 = 200 → totalt = 1000
  close(r.totalToPay, 1000, "att betala");
});

test("MF blir noll när taket redan är nått", () => {
  const r = calculateFees(12500, mfCapExVat, config);
  close(r.mfFee, 0, "ingen MF-avgift över taket");
  close(r.mfFeeAccumulated, mfCapExVat, "ackumulerat oförändrat vid taket");
  close(r.ftFee, 750, "FT-avgift fortsätter alltid");
  // moms = 750 * 0.25 = 187,5 → totalt = 937,5
  close(r.totalToPay, 937.5, "att betala (endast FT + moms)");
});

test("MF överskrider aldrig taket även vid stor försäljning", () => {
  const r = calculateFees(10_000_000, 0, config);
  close(r.mfFee, mfCapExVat, "MF kapas till taket");
  close(r.mfFeeAccumulated, mfCapExVat, "ackumulerat = taket");
});

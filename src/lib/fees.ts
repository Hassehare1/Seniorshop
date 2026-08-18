import Decimal from "decimal.js";

// Pengar räknas i decimal.js — aldrig i flyttal. Float ger öresfel som
// ackumuleras (särskilt i MF-takets löpande summa) och gör lagrade belopp
// omöjliga att jämföra exakt mot omräknade. decimal.js valdes framför
// Prisma.Decimal för att beräkningen även körs i webbläsaren (ReportForm
// visar avgifter live medan FT skriver).

// Belopp får tas emot som tal, sträng eller Decimal (Prisma returnerar en
// egen Decimal-instans vid läsning — dess toString är exakt).
export type MoneyInput = Decimal | number | string;

// Kronor avrundas till öre. Halva ören uppåt (normal praxis för pengar).
const ORE = 2;
function toOre(value: Decimal): Decimal {
  return value.toDecimalPlaces(ORE, Decimal.ROUND_HALF_UP);
}

export function money(value: MoneyInput): Decimal {
  return new Decimal(value.toString());
}

// Summera belopp exakt. Använd i stället för `arr.reduce((a, b) => a + b, 0)` —
// Prismas Decimal stödjer inte `+` och flyttalssummor driver.
export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(money(v)), new Decimal(0));
}

// Server→klient-gränsen: Decimal går inte att serialisera till en
// klientkomponent. Presentationsvärden (diagram, nyckeltal) konverteras här —
// det bindande beloppet är redan uträknat och lagrat exakt.
export function toNumber(value: MoneyInput): number {
  return money(value).toNumber();
}

export interface FeeConfig {
  ftFeePercent: number;
  mfFeePercent: number;
  mfFeeCap: MoneyInput;
  vatMultiplier: number;
}

/**
 * Standardvillkoren i SeniorShops franchiseavtal.
 *
 * ENDA STÄLLET dessa tal ska stå i koden. De låg tidigare utspridda på sju
 * ställen, och en av kopiorna hade hunnit glida isär: fee-config-routen skapade
 * taket som 5999.812 (4799,85 × 1,25) i stället för 6000. Ingenting larmade,
 * eftersom varje ställe för sig såg rimligt ut.
 *
 * Taket är 6000 kr INKLUSIVE moms — verifierat mot FT:s Excel. Beräkningen
 * jämför internt mot beloppet ex moms (6000 / 1,25 = 4800), se calculateFees.
 *
 * OBS: `@default`-värdena i prisma/schema.prisma måste hållas i takt för hand.
 * Prisma kan inte läsa TypeScript, och defaults gäller bara nya rader — ändras
 * villkoren måste befintliga FeeConfig-rader uppdateras med en migration.
 */
export type StandardFeeConfig = {
  ftFeePercent: number;
  mfFeePercent: number;
  mfFeeCap: number;
  vatMultiplier: number;
};

export const STANDARD_FEE_CONFIG: StandardFeeConfig = Object.freeze({
  ftFeePercent: 0.075,
  mfFeePercent: 0.01,
  mfFeeCap: 6000, // ink moms
  vatMultiplier: 1.25,
});

export interface FeeCalculation {
  ftFee: Decimal;
  mfFee: Decimal;
  mfFeeAccumulated: Decimal;
  vat: Decimal;
  totalToPay: Decimal;
}

export function calculateFees(
  sales: MoneyInput,
  currentMfAccumulated: MoneyInput,
  config: FeeConfig
): FeeCalculation {
  const salesInkVat = money(sales);
  const accumulated = money(currentMfAccumulated);
  const vatMultiplier = new Decimal(config.vatMultiplier);

  const salesExVat = salesInkVat.div(vatMultiplier);
  const ftFeeExVat = toOre(salesExVat.times(config.ftFeePercent));
  const mfFeeExVat = toOre(salesExVat.times(config.mfFeePercent));

  // MF-taket lagras ink moms (avgiftskonfig), men MF ackumuleras ex moms —
  // konvertera taket till ex moms innan jämförelsen.
  const mfFeeCapExVat = toOre(money(config.mfFeeCap).div(vatMultiplier));
  const remainingMfCap = Decimal.max(0, mfFeeCapExVat.minus(accumulated));
  const mfFeeExVatCapped = Decimal.min(mfFeeExVat, remainingMfCap);

  const mfFeeAccumulated = accumulated.plus(mfFeeExVatCapped);

  const vat = toOre(ftFeeExVat.plus(mfFeeExVatCapped).times(vatMultiplier.minus(1)));
  const totalToPay = ftFeeExVat.plus(mfFeeExVatCapped).plus(vat);

  return {
    ftFee: ftFeeExVat,
    mfFee: mfFeeExVatCapped,
    mfFeeAccumulated,
    vat,
    totalToPay,
  };
}

// Enhetlig kr-formatering på skärmen — hela kronor (öre visas i Excel-export).
// Centraliserad: vill man visa öre ändras det bara här.
export function formatSEK(amount: MoneyInput): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(money(amount).toNumber());
}

// Exakt öresbelopp för Excel-export ("1234.50"), utan tusentalsavgränsare.
export function formatOre(amount: MoneyInput): string {
  return toOre(money(amount)).toFixed(ORE);
}

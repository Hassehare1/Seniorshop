export interface FeeConfig {
  ftFeePercent: number;
  mfFeePercent: number;
  mfFeeCap: number;
  vatMultiplier: number;
}

export interface FeeCalculation {
  ftFee: number;
  mfFee: number;
  mfFeeAccumulated: number;
  vat: number;
  totalToPay: number;
}

export function calculateFees(
  sales: number,
  currentMfAccumulated: number,
  config: FeeConfig
): FeeCalculation {
  const ftFeeExVat = sales / config.vatMultiplier * config.ftFeePercent;
  const mfFeeExVat = sales / config.vatMultiplier * config.mfFeePercent;

  const remainingMfCap = Math.max(0, config.mfFeeCap - currentMfAccumulated);
  const mfFeeExVatCapped = Math.min(mfFeeExVat, remainingMfCap);

  const mfFeeAccumulated = currentMfAccumulated + mfFeeExVatCapped;

  const vat = (ftFeeExVat + mfFeeExVatCapped) * (config.vatMultiplier - 1);
  const totalToPay = ftFeeExVat + mfFeeExVatCapped + vat;

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
export function formatSEK(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}

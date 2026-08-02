-- Pengar från flyttal (double precision) till exakt decimal med öresprecision.
--
-- Varför: Float ger avrundningsfel som ackumuleras — särskilt i MF-takets
-- löpande summa (mfFeeAccumulated) — och gör att lagrade belopp inte kan
-- jämföras exakt mot omräknade (api/reports gör just den jämförelsen).
-- Görs medan beloppen ännu är testdata; efter skarpa belopp hade konverteringen
-- krävt avstämning av varje befintlig rad.
--
-- Satserna (ftFeePercent, mfFeePercent, vatMultiplier) är kvoter, inte belopp,
-- och förblir Float.

-- AlterTable
ALTER TABLE "FeeConfig" ALTER COLUMN "mfFeeCap" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Visit" ALTER COLUMN "sales" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "fashionShowSales" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "ftFee" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "mfFee" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "mfFeeAccumulated" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalToPay" SET DATA TYPE DECIMAL(12,2);

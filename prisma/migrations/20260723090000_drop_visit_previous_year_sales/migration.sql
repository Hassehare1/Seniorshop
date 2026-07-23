-- Städning: droppa oanvänd kolumn Visit.previousYearSales.
-- Var tänkt för år-mot-år men den funktionen byggdes utan fältet (räknar ur
-- faktiska fjolårsrapporter). Kolumnen refereras aldrig i koden och är alltid NULL.
ALTER TABLE "Visit" DROP COLUMN "previousYearSales";

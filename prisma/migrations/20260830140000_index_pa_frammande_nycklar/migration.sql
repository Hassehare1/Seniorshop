-- Index på de främmande nycklar som faktiskt används i frågor.
--
-- Postgres indexerar INTE främmande nycklar automatiskt — till skillnad från
-- MySQL. Tre kolumner saknade index och används i heta vägar:
--
--   Visit.reportId         deleteMany vid VARJE sparad veckorapport
--                          (api/reports POST, två ställen + importen), och
--                          FK-kontrollen när en rapport tas bort
--   Visit.customerId       updateMany vid kundsammanslagning, och
--                          FK-kontrollen när en kund raderas (merge +
--                          nollställning). Utan index läser den en full
--                          Visit-tabell per raderad kund.
--   WeeklyReport.seasonId  helårsprognosen hämtar flera säsonger UTAN
--                          distriktsfilter när admin ser alla distrikt
--                          (insights/forecast.ts). Det sammansatta unika
--                          indexet börjar på districtId och biter inte då.
--
-- MEDVETET UTELÄMNADE: User.districtId, WeeklyReport.userId och
-- SeasonGoal.seasonId. Ingen fråga filtrerar på dem, och de tabellerna
-- raderas aldrig av appen — ett index där hade varit ren vana.
--
-- SQL:en är genererad av `prisma migrate diff` mot schemat, inte handskriven,
-- så namn och form följer Prismas egen konvention. (`prisma migrate dev` går
-- inte att använda i det här repot: migrationen 20260722090000 slår på RLS för
-- `_prisma_migrations`, som inte finns i Prismas skuggdatabas, och varje
-- migrate dev faller därför på P3006.)
--
-- LÅSNING: CREATE INDEX tar ett SHARE-lås som blockerar skrivningar mot
-- tabellen medan det byggs. Visit har ~1000 rader i produktion, så det rör sig
-- om millisekunder. CONCURRENTLY används INTE — det kan inte köras inuti en
-- transaktion, och Prisma kör varje migration i en.
--
-- ÅTERSTÄLLNING: DROP INDEX "Visit_reportId_idx", "Visit_customerId_idx",
--                           "WeeklyReport_seasonId_idx";

-- CreateIndex
CREATE INDEX "Visit_reportId_idx" ON "Visit"("reportId");

-- CreateIndex
CREATE INDEX "Visit_customerId_idx" ON "Visit"("customerId");

-- CreateIndex
CREATE INDEX "WeeklyReport_seasonId_idx" ON "WeeklyReport"("seasonId");

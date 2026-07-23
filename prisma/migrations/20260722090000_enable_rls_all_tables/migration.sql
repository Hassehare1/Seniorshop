-- Säkerhet: slå på Row-Level Security (RLS) på alla publika tabeller.
--
-- Varför: utan RLS är tabellerna åtkomliga via Supabases publika auto-API
-- (PostgREST, anon-rollen) för vem som helst med projekt-URL + anon-nyckel.
--
-- Varför det är ofarligt för appen: appen kör via Prisma som `postgres`-rollen,
-- som ÄGER tabellerna. En tabellägare kringgår RLS (vi sätter inte FORCE), så
-- appens åtkomst är oförändrad. Vi lägger MEDVETET inga policies — då nekas
-- anon/authenticated (det publika API:t) helt, vilket är precis meningen.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "District" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeeConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Season" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeasonGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Visit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
-- Prismas interna historiktabell (bara migrationsmetadata) — täcks så Supabases
-- linter blir helt grön. Migrationsköraren är postgres (ägare) och kringgår RLS.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

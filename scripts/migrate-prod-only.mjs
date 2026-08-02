// Kör `prisma migrate deploy` ENDAST för produktionsdeployer.
//
// Varför: Vercel bygger även feature-grenar, och preview-deployerna får samma
// DATABASE_URL som produktion. Utan den här spärren kör en `git push` av VILKEN
// gren som helst migrationerna skarpt mot prod-databasen — innan koden är
// mergad. Det hände 2026-08-02: en preview-deploy droppade Customer.size i
// prod medan produktionen fortfarande körde koden som läste kolumnen, och
// kundsidorna gav 500 tills main hann deployas.
//
// VERCEL_ENV är "production" | "preview" | "development" på Vercel, och saknas
// vid lokala bygg. Lokalt sköts schemat med `prisma migrate dev` / `migrate
// reset`, så även där hoppar vi över.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const vercelEnv = process.env.VERCEL_ENV;

if (!vercelEnv) {
  console.log("[migrate] Lokalt bygge (VERCEL_ENV saknas) — hoppar över migrate deploy.");
  process.exit(0);
}

if (vercelEnv !== "production") {
  console.log(
    `[migrate] VERCEL_ENV=${vercelEnv} — hoppar över migrate deploy.\n` +
    "[migrate] Migrationer körs bara för produktion; preview delar prod-databas."
  );
  process.exit(0);
}

console.log("[migrate] Produktionsbygge — kör prisma migrate deploy.");

// Kör CLI:t via dess JS-fil i stället för kommandonamnet "prisma": node_modules/.bin
// ligger inte garanterat i PATH, och ett tyst misslyckande här skulle betyda att
// produktionsdeployer slutar migrera utan att någon märker det.
const require = createRequire(import.meta.url);
const prismaCli = path.join(path.dirname(require.resolve("prisma/package.json")), "build", "index.js");

execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit" });

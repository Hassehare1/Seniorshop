import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Tillåt avsiktligt oanvända variabler/argument med _-prefix (t.ex. _ph vid destrukturering)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Varning, ej fel: vi använder legitima mönster (laddnings-flagga före fetch,
      // stäng meny vid navigering) där setState i effekt är korrekt.
      "react-hooks/set-state-in-effect": "warn",
      // All serverloggning ska gå genom src/lib/logg.ts, så att den blir
      // strukturerad, sökbar och har ETT ställe där en extern
      // felrapporteringstjänst kan kopplas in. Ett löst console.log hamnar
      // utanför allt det. Undantagen står nedan.
      "no-console": "error",
    },
  },
  {
    // Loggern ÄR omslaget runt console — den måste få använda det.
    files: ["src/lib/logg.ts"],
    rules: { "no-console": "off" },
  },
  {
    // Felgränserna är klientkomponenter. Webbläsarkonsolen är rätt plats för
    // ett fel som redan visas för användaren; serversidan fångas i stället av
    // onRequestError i src/instrumentation.ts.
    files: ["src/app/error.tsx", "src/app/global-error.tsx"],
    rules: { "no-console": "off" },
  },
  {
    // Kommandoradsskript (seed, migrationsspärren i bygget). De kör utanför
    // serverkörningen och skriver till en terminal eller en bygglogg —
    // console ÄR deras utdata, och de kan inte importera från src/.
    files: ["prisma/**/*.ts", "scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

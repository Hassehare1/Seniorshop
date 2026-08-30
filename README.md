# SeniorShop Portal

Franchiseportal för SeniorShop. Franchisetagare (FT) rapporterar sina besök vecka
för vecka, portalen räknar ut avgifterna, och SeniorShop centralt får en samlad
bild av försäljning, mål och kundregister.

Portalen är i skarp drift med pilotdeltagare sedan hösten 2026.
`main` = produktion (se [Driftsättning](#driftsättning)).

---

## Snabbstart

```bash
docker compose up -d db
```

```bash
npm install && npx prisma migrate dev && npm run db:seed && npm run dev
```

Öppna http://localhost:3000. Databasen ligger i Docker på port **5433** (inte
5432 — så den inte krockar med en Postgres du redan kör).

Testkonton från seed:

| Roll | E-post | Lösenord |
|---|---|---|
| Admin | `admin@seniorshop.se` | `admin123` |
| Franchisetagare, distrikt 6 | `ft6@seniorshop.se` | `ft123` |

Kopiera `.env.example` till `.env` och fyll i. Lokalt räcker:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/seniorshop"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/seniorshop"
NEXTAUTH_SECRET="valfri-sträng-lokalt"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Kör hela kedjan innan du pushar

CI kör tre steg. Kör alla tre lokalt — lint är den som glöms och den har fällt
bygget fem commits i rad tidigare:

```bash
npm run lint && npm test && npx next build
```

---

## Arkitektur

| | |
|---|---|
| Ramverk | Next.js 16, App Router, React 19 |
| Språk | TypeScript (`strict`) |
| Databas | PostgreSQL via Prisma 5 — Supabase i produktion |
| Inloggning | Auth.js (next-auth v5), JWT-sessioner, 7 dygn |
| Utseende | Tailwind v4 |
| Diagram | Recharts |
| Drift | Vercel, region `arn1` (Stockholm — nära databasen) |

**Serverkomponenter hämtar data, klientkomponenter tar emot den som props.**
Sidorna under `src/app/*/page.tsx` gör Prisma-anropen direkt; interaktiviteten
ligger i en `*Client.tsx` bredvid. API-routerna används för det som ändrar
något, inte för den första inläsningen.

### Var saker ligger

```
src/
  app/
    api/            32 route handlers — allt som skriver
    dashboard/      Översikt: analys, mål, helårsprognos
    rapportera/     FT:s veckoformulär (portalens hjärta)
    kunder/         FT:s kundregister
    forsaljning/    Rådata + Excel-export
    admin/          Distrikt, användare, säsonger, rapporter, import, assistent
    profil/         Lösenordsbyte, temaval
  lib/
    fees.ts         Avgiftsuträkning — pengar som Decimal, aldrig flyttal
    authz.ts        requireSession / requireAdmin — behörighet, ett ställe
    season.ts       Vilken säsong en vecka tillhör
    week.ts         ISO-veckonummer
    logg.ts         Strukturerad serverlogg
    insights/       Aggregering, jämförelser, prognos, AI-assistentens verktyg
  components/       Delade UI-komponenter (få — se Kända skulder)
  instrumentation.ts  Global felfångst
  proxy.ts          Inloggningsgrind + CSP (hette middleware före Next 16)
prisma/
  schema.prisma     Datamodellen
  migrations/       Körs skarpt vid deploy till produktion
```

---

## Domänmodellen

Sex begrepp räcker för att förstå portalen:

**Distrikt** — ett geografiskt område med en franchisetagare. Har egna
avgiftsvillkor (`FeeConfig`) som skapas automatiskt med standardvärden.

**Säsong** — `Vår` eller `Höst` ett visst år, avgränsad av ett veckospann
(`weekStart`–`weekEnd`). **Säsonger läggs in manuellt av admin.** Ett helår =
Vår + Höst.

**Kund** — en plats där FT håller visningar: äldreboende, träffpunkt,
pensionärsförening… Elva kategorier, som följer SeniorShops egen indelning.
Kunder tillhör ett distrikt och har ett löpnummer inom det (`D6-14`).

**Veckorapport** — en FT:s besök under en vecka. En rapport per
distrikt × säsong × vecka. Går `DRAFT` → `SUBMITTED` → `APPROVED`. En godkänd
rapport kan bara låsas upp av admin.

**Besök** — ett tillfälle hos en kund: antal besökare, försäljning, och om det
var modevisning, visning på galge eller rea. **En kund får bara rapporteras en
gång per vecka.**

**Avgifter** — räknas alltid om på servern, klientens värden ignoreras.
FT-avgift är en procentsats på försäljningen. MF-avgiften har ett **tak per
säsong** som ackumuleras över veckorna — vilket är varför en ändring i vecka 12
tvingar fram en omräkning av vecka 13 och framåt (`recomputeLaterWeeks` i
`api/reports/route.ts`).

### Vem gör vad

| | Franchisetagare | Admin |
|---|---|---|
| Rapportera veckor | Ja, för sitt eget distrikt | Ja, för alla |
| Skapa kunder | **Ja** | Nej — admin granskar och godkänner |
| Godkänna rapporter | Nej | Ja |
| Se sin egen FT-avgift | **Nej, aldrig** | Ja |
| Säsonger, distrikt, användare | Nej | Ja |

---

## Behörighet

Två lager, båda behövs:

1. **`src/proxy.ts`** grindar sidorna — oinloggad går till `/login`, icke-admin
   kommer inte in på `/admin/*`.
2. **`src/lib/authz.ts`** grindar API:t. Varje route börjar med:

```ts
const session = await requireSession();   // eller requireAdmin()
if (session instanceof NextResponse) return session;
```

Routes som tar ett `[id]` gör dessutom en ägarskapskontroll: hämta posten,
jämför `districtId` mot sessionens, neka annars. Den kontrollen är inte
valfri — utan den kan vilken FT som helst läsa ett annat distrikts siffror
genom att gissa ett id.

> **Grinda alltid på `session.user`, aldrig på `session` ensamt.** Vid
> konfigurationsfel kan `auth()` returnera ett *felobjekt* i stället för null
> (Auth.js GHSA-8fpg-xm3f-6cx3). Ett objekt är sanningsvärde-sant, så
> `if (!session)` släpper då igenom alla. `user` finns bara på en äkta session.

---

## Driftsättning

**En push till `main` går till produktion inom en minut, och migrationerna körs
skarpt.** Det finns ingen mellanlandning.

Migrationerna körs av `scripts/migrate-prod-only.mjs`, som bara kör
`prisma migrate deploy` när `VERCEL_ENV=production`.

> ⚠️ **Preview-deployer delar databas med produktion.** Vercel bygger varje
> gren, och de bygena får samma `DATABASE_URL` som prod. Spärren ovan finns
> just därför — utan den körde en push av vilken gren som helst migrationerna
> mot skarp data. Det hände 2026-08-02: en preview-deploy tog bort en kolumn
> som produktionskoden fortfarande läste, och kundsidorna gav 500 tills `main`
> hann deployas. **Tänk efter en extra gång innan du pushar en gren som
> innehåller en migration.**

Miljövariabler i produktion: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `CRON_SECRET`, `ANTHROPIC_API_KEY` (bara för AI-assistenten).

Ett schemalagt jobb gallrar händelseloggen kl 03 varje natt (`vercel.json`).

---

## Runbook

**Jag ser ett fel i produktion.** Vercels loggvy. Alla serverfel loggas som en
rad JSON med `"level":"fel"`, och innehåller sökväg, route och felmeddelande.
Har användaren fått en **felkod** på skärmen är det `digest`-fältet i loggen —
sök på den.

**En FT säger att hon inte kan rapportera.** Kontrollera först att säsongen
finns. Saknas den — t.ex. `Höst 2026` — går det *inte* att rapportera alls, och
sidan säger "Ingen aktiv säsong". Lägg in säsongen under `/admin/sasonger`.
Det här återkommer varje vår och höst.

**En godkänd rapport behöver ändras.** Admin låser upp den i
`/admin/rapporter`. FT kan inte göra det själv.

**Siffrorna stämmer inte mot en Excel-fil vid import.** Importen matchar på
kolumnRUBRIK, aldrig kolumnposition. Har filen flera ifyllda
kundtyp-kolumner för samma rad varnar importen och säger hur mycket som faller
bort. Slutrapporten efter importen listar avvikelserna.

**Jag behöver nolla testdata.** `/admin/import` har en nollställningsknapp
(bekräftelseord `TÖMMA`). Den raderar **bara** besök och veckorapporter —
kunder, distrikt, säsonger, användare och mål ligger kvar.

**Jag vill nollställa hela den lokala databasen.**

```bash
npx prisma migrate reset
```

Kör den aldrig mot annat än en lokal databas. Du blir utloggad efteråt —
sessionen pekar på ett användar-id som inte finns längre.

---

## Test och kvalitet

```bash
npm test
```

101 tester, körda med Nodes inbyggda testkörare. De täcker den rena
beräkningslogiken i `src/lib` — avgifter, mål, säsonger, veckor, aggregering,
importens kolumntolkning.

Fel i produktion fångas globalt av `onRequestError` i
`src/instrumentation.ts` och loggas strukturerat genom `src/lib/logg.ts`.
All serverloggning ska gå den vägen; `no-console` är påslagen i lintern för
att hålla den regeln.

### Kända skulder

Medvetna, prioriterade, inte glömda:

- **Inga tester mot databasen.** De 32 API-routerna verifieras manuellt i
  webbläsaren. Fungerar, men skalar inte om fler rör koden.
- **Ingen indatavalidering** (zod eller motsvarande). Fält från `req.json()`
  går delvis rakt in i Prisma.
- **27 av 32 routes saknar `try/catch`.** De loggas numera globalt, men svarar
  fortfarande med en tom 500.
- **Inget komponentbibliotek.** Knappar och formulärfält är handskrivna i varje
  vy; samma klassträng återkommer på många ställen.
- **`bg-blue-600` betyder "varumärkesfärg", inte blå.** Temaväxlaren i
  `/profil` skriver över Tailwinds `--color-blue-*` i `globals.css`.
- **`next-auth` är på en beta-version.**

---

## Fällor som kostat tid

- **Två vyer av samma sak.** Kundlistan finns i två separata komponenter — en
  för FT (`/kunder`) och en för admin (`/admin/kunder`). Ändrar du beteende i
  den ena måste du ändra och **verifiera** den andra. Det har missats förr.
- **`useState(props)` fryser vyn.** Initieras state från en prop som ändras vid
  säsongsbyte uppdateras det aldrig, och vyn visar förra säsongens data — vilket
  ser ut som saknad data, inte som en bugg. Lös med `key` på komponenten.
- **Svenska tecken i kund-id.** Id:n kan innehålla `å ä ö`, och macOS och
  webbläsare normaliserar dem olika (NFC/NFD). Jämför alltid mot båda formerna
  — se `api/customers/[id]/route.ts`.
- **CSP-nonce finns inte på statiska sidor.** Testa alltid CSP i ett skarpt
  bygge (`next build && next start`), aldrig i dev — policyn är strängare i
  produktion.
- **Inga Prisma-anrop i Auth.js `jwt`-callbacken.** Den körs även i proxyn, och
  Prisma i den kontexten ger sporadiska 500 på Vercel.
- **Recharts läser inte CSS-variabler.** Diagrammens färger ligger i
  `src/lib/theme.ts` och skickas ner som props.

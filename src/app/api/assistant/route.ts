import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { auth } from "@/lib/auth";
import { assistantTools, currentSeason, runAssistantTool, type ToolScope } from "@/lib/insights/tools";
import { parseMeddelanden } from "@/lib/insights/messages";

// Assistenten är admin-låst medan den mognar. Öppnas den för FT är det den här
// raden som tas bort — behörigheten i verktygen är redan skriven för båda
// rollerna (se resolveDistrict i lib/insights/tools.ts).
const ADMIN_ONLY = true;

// Billigaste modellen medan detta är ett försök: Haiku 4.5 kostar 1 kr in /
// 5 kr ut per miljon tokens, mot Opus 5:s 5 / 25. Uppgiften är enkel — välja
// verktyg, läsa JSON och skriva en mening — vilket är precis vad Haiku är bra på.
// Vill du prova en dyrare modell räcker det att sätta ASSISTANT_MODEL i Vercel.
// OBS: `effort` och `fallbacks` finns bara på 4.6+ och ger 400 här. Byter du
// upp till Opus 5 är det de två du vill lägga tillbaka.
const MODEL = process.env.ASSISTANT_MODEL ?? "claude-haiku-4-5";

function systemPrompt(nu: { namn: string; idag: string; pagaende: boolean } | null) {
  const tidsbild = nu
    ? `I dag är det ${nu.idag}. Den säsong som ${nu.pagaende ? "pågår" : "senast var aktuell"} är ${nu.namn}.`
    : "Det finns inga säsonger upplagda i portalen ännu.";

  return `Du är en assistent i SeniorShops franchiseportal. Du svarar på frågor om
försäljning, besök och mål genom att anropa portalens verktyg.

${tidsbild}

Viktigt:
- Räkna ALDRIG själv. Alla siffror ska komma ur verktygens svar, ordagrant.
  Kan du inte hämta en siffra säger du det i stället för att uppskatta.
- Nämner frågan ingen säsong gäller den den aktuella. Utelämna då seasonId helt
  i stället för att gissa — verktyget fyller i rätt säsong åt dig.
- Anropa lista_sasonger bara när frågan gäller en annan säsong än den aktuella,
  eller när du behöver veta vilka som finns.
- Skriv alltid ut vilken säsong svaret gäller, så att läsaren kan se om du
  förstått frågan rätt.
- Får du tillbaka sasongerMedMal betyder det att målen saknas för den säsongen
  men finns för andra. Nämn vilka i stället för att bara säga att målen saknas.
- Jämför du år mot år: skriv alltid ut fältet omfattning. En pågående säsong
  jämförs bara på de veckor som hunnit passera, och utelämnas det låter en
  avkortad jämförelse som en hel säsong.
- Håll isär vad portalen vet och vad du själv slutit dig till. Siffrorna och
  jämförelserna kommer ur verktygen och skrivs som de står. Drar du en egen
  slutsats om varför något ser ut som det gör är det ofta värdefullt — men
  skriv den som en egen mening som börjar med t.ex. "Rimligen" eller "En
  förklaring kan vara", så att läsaren ser att den är din och inte portalens.
- Svara kort och på svenska, i löpande text. Inga rubriker eller punktlistor om
  frågan inte handlar om en lista.
- Beloppen från verktygen är redan formaterade — skriv dem som de står.`;
}

/** Vad servern faktiskt slog upp. Byggs ur verktygens svar, inte ur modellens text. */
type Uppslag = { verktyg: string; urval?: string; sasong?: string };


export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "ADMIN";
  if (ADMIN_ONLY && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY saknas — lägg in den bland miljövariablerna." },
      { status: 503 },
    );
  }

  const meddelanden = parseMeddelanden(await req.json());
  if (meddelanden.length === 0) {
    return NextResponse.json({ error: "Ingen fråga skickades." }, { status: 400 });
  }

  // Härleds ur sessionen, aldrig ur frågan. En FT kan inte fråga sig till ett
  // annat distrikt, oavsett hur hon formulerar sig.
  const scope: ToolScope = {
    isAdmin,
    ownDistrictId: isAdmin ? null : (session.user.districtId ?? null),
  };

  const client = new Anthropic();
  const uppslag: Uppslag[] = [];
  const tools = assistantTools.map(t =>
    betaTool({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      run: async (input: Record<string, unknown>) => {
        const r = (await runAssistantTool(t.name, input, scope)) as Record<string, unknown>;
        // Loggas ur resultatet, alltså serverns egna värden. Skulle modellen
        // påstå fel säsong eller distrikt i texten syns avvikelsen här.
        uppslag.push({
          verktyg: t.name,
          urval: typeof r.urval === "string" ? r.urval : undefined,
          sasong: typeof r.sasong === "string" ? r.sasong : undefined,
        });
        return JSON.stringify(r);
      },
    }),
  );

  try {
    const message = await client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(await currentSeason()),
      tools,
      messages: meddelanden,
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Modellen avböjde att svara på den frågan." },
        { status: 422 },
      );
    }

    const svar = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map(b => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ svar: svar || "Modellen svarade utan text.", uppslag });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "För många frågor just nu — försök igen om en stund." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "API-nyckeln godtogs inte." }, { status: 502 });
    }
    const detalj = err instanceof Anthropic.APIError ? err.message : "Okänt fel";
    return NextResponse.json({ error: `Något gick fel: ${detalj}` }, { status: 502 });
  }
}

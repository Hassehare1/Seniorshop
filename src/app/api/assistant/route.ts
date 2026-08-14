import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { auth } from "@/lib/auth";
import { assistantTools, runAssistantTool, type ToolScope } from "@/lib/insights/tools";

// Assistenten är admin-låst medan den mognar. Öppnas den för FT är det den här
// raden som tas bort — behörigheten i verktygen är redan skriven för båda
// rollerna (se resolveDistrict i lib/insights/tools.ts).
const ADMIN_ONLY = true;

const SYSTEM = `Du är en assistent i SeniorShops franchiseportal. Du svarar på frågor om
försäljning, besök och mål genom att anropa portalens verktyg.

Viktigt:
- Räkna ALDRIG själv. Alla siffror ska komma ur verktygens svar, ordagrant.
  Kan du inte hämta en siffra säger du det i stället för att uppskatta.
- Gäller frågan en säsong: anropa lista_sasonger först för att få rätt seasonId.
  "Hösten" eller "i höstas" betyder den senaste Höst-säsongen om inget år anges.
- Svara kort och på svenska, i löpande text. Inga rubriker eller punktlistor om
  frågan inte handlar om en lista.
- Beloppen från verktygen är redan formaterade — skriv dem som de står.`;

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

  const { fraga } = await req.json();
  if (typeof fraga !== "string" || fraga.trim() === "") {
    return NextResponse.json({ error: "Ingen fråga skickades." }, { status: 400 });
  }

  // Härleds ur sessionen, aldrig ur frågan. En FT kan inte fråga sig till ett
  // annat distrikt, oavsett hur hon formulerar sig.
  const scope: ToolScope = {
    isAdmin,
    ownDistrictId: isAdmin ? null : (session.user.districtId ?? null),
  };

  const client = new Anthropic();
  const tools = assistantTools.map(t =>
    betaTool({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      run: (input: Record<string, unknown>) =>
        runAssistantTool(t.name, input, scope).then(r => JSON.stringify(r)),
    }),
  );

  try {
    const message = await client.beta.messages.toolRunner({
      model: "claude-opus-5",
      // Tänkandet ryms i max_tokens tillsammans med svaret — snålt tak kapar svaret.
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      tools,
      messages: [{ role: "user", content: fraga }],
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

    return NextResponse.json({ svar: svar || "Modellen svarade utan text." });
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

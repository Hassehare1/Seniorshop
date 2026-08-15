export type Meddelande = { role: "user" | "assistant"; content: string };

/** Hur många meddelanden som skickas med. Håller kostnaden nere i långa samtal. */
export const MAX_MEDDELANDEN = 20;

/**
 * Samtalshistoriken från klienten, rensad.
 *
 * Klienten får skicka vad som helst, så inget släpps igenom otittat: bara
 * rollerna user och assistant, bara icke-tom text. Historiken kapas till de
 * senaste meddelandena, och eftersom Anthropic kräver att samtalet börjar hos
 * användaren klipps ledande assistant-svar bort — annars ger ett kapat samtal
 * ett fel i stället för ett svar.
 *
 * Den äldre formen `{ fraga }` accepteras fortfarande, så att en klient som
 * inte hunnit laddas om inte slutar fungera mitt i.
 */
export function parseMeddelanden(body: unknown): Meddelande[] {
  const b = (body ?? {}) as { meddelanden?: unknown; fraga?: unknown };

  if (typeof b.fraga === "string" && b.fraga.trim() !== "") {
    return [{ role: "user", content: b.fraga.trim() }];
  }
  if (!Array.isArray(b.meddelanden)) return [];

  const rensade = b.meddelanden.flatMap((m): Meddelande[] => {
    const r = (m as { role?: unknown })?.role;
    const c = (m as { content?: unknown })?.content;
    if ((r !== "user" && r !== "assistant") || typeof c !== "string" || c.trim() === "") return [];
    return [{ role: r, content: c.trim() }];
  });

  const kapade = rensade.slice(-MAX_MEDDELANDEN);
  const första = kapade.findIndex(m => m.role === "user");
  return första === -1 ? [] : kapade.slice(första);
}

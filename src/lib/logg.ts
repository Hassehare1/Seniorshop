/**
 * Strukturerad serverlogg.
 *
 * Före det här fanns två `console.*`-anrop i hela portalen. Ett fel i en
 * API-route försvann alltså spårlöst: användaren fick en 500 utan text, och
 * ingenstans stod det vad som hänt. Den här modulen är motsatsen — en rad per
 * händelse, i ett format som går att söka i.
 *
 * FORMATET: en rad JSON per händelse, till stdout/stderr. Vercel fångar båda
 * och tolkar JSON automatiskt, så fälten blir sökbara i loggvyn utan extra
 * uppsättning. Nycklarna är därför engelska (`level`, `message`, `time`) —
 * inte av stilskäl utan för att i stort sett alla loggverktyg, Vercels eget
 * inkluderat, särbehandlar just de namnen. Värden och beskrivningar är
 * svenska som resten av portalen.
 *
 * I utvecklingsläge skrivs det i stället läsbart för en människa; JSON-rader i
 * en terminal är obrukbara att felsöka i.
 *
 * INGA HEMLIGHETER I LOGGEN. Se `sakraHeaders` längst ned — headers får bara
 * passera via en tillåtlista, eftersom `cookie` innehåller hela sessionen och
 * `authorization` innehåller CRON_SECRET. En logg är inte en säker plats.
 *
 * Modulen är avsiktligt beroendefri och använder bara `console`, så att den
 * fungerar likadant i Node-körningen (API-routes) och i Edge-körningen
 * (proxy.ts).
 */

export type Niva = "info" | "varning" | "fel";

/** Extra fält som följer med händelsen. Håll dem små och sökbara. */
export type Kontext = Record<string, unknown>;

const ar_utveckling = process.env.NODE_ENV === "development";

/**
 * Plockar isär ett okänt kastat värde till något loggbart. Tar `unknown` och
 * inte `Error` med flit: det som fångas i en catch eller kommer från Next kan
 * vara vad som helst, och loggningen får aldrig vara det som kastar.
 */
function beskrivFel(fel: unknown): Kontext {
  if (fel instanceof Error) {
    return {
      errorName: fel.name,
      errorMessage: fel.message,
      stack: fel.stack,
      // Next sätter `digest` på serverfel och visar samma sträng för
      // användaren som "Felkod" i error.tsx. Den är alltså bryggan mellan
      // "något gick fel"-skärmen och den här loggraden — utan den går ett
      // felmeddelande från en FT inte att slå upp.
      ...("digest" in fel && fel.digest ? { digest: String(fel.digest) } : {}),
      ...(fel.cause !== undefined ? { cause: String(fel.cause) } : {}),
    };
  }
  return { errorMessage: String(fel) };
}

function skriv(level: Niva, message: string, kontext: Kontext = {}): void {
  const rad = {
    level,
    message,
    time: new Date().toISOString(),
    ...kontext,
  };

  if (ar_utveckling) {
    const { level: _l, message: _m, time: _t, ...resten } = rad;
    const prefix = level === "fel" ? "✖" : level === "varning" ? "▲" : "·";
    const svans = Object.keys(resten).length ? ` ${JSON.stringify(resten)}` : "";
    (level === "fel" ? console.error : console.log)(`${prefix} ${message}${svans}`);
    return;
  }

  // JSON.stringify kan kasta på cirkulära referenser. En logg som fäller
  // anropet den loggar vore värre än ingen logg alls.
  let text: string;
  try {
    text = JSON.stringify(rad);
  } catch {
    text = JSON.stringify({ level, message, time: rad.time, note: "kontext gick inte att serialisera" });
  }
  (level === "fel" ? console.error : console.log)(text);
}

export const logg = {
  info: (message: string, kontext?: Kontext) => skriv("info", message, kontext),
  varning: (message: string, kontext?: Kontext) => skriv("varning", message, kontext),

  /**
   * Loggar ett fel. `fel` tas som `unknown` och plockas isär säkert.
   *
   * DET HÄR ÄR SÖMMEN mot en extern felrapporteringstjänst. Väljer Johan
   * någon gång Sentry eller motsvarande är det den här funktionen som får
   * ett anrop till — ingen annan fil behöver röras, eftersom allt som
   * rapporterar fel går genom den.
   */
  fel: (message: string, fel: unknown, kontext?: Kontext) =>
    skriv("fel", message, { ...kontext, ...beskrivFel(fel) }),
};

/**
 * Headers som är ofarliga att logga.
 *
 * Tillåtlista, inte blocklista — en blocklista glömmer alltid nästa header
 * som råkar bära något känsligt. `cookie` bär hela sessionen och
 * `authorization` bär CRON_SECRET; ingen av dem hör hemma i en logg.
 *
 * `x-vercel-id` är med för att den knyter loggraden till Vercels egen
 * begäran-logg, vilket är det som gör två system sökbara mot varandra.
 */
const SAKRA_HEADERS = [
  "user-agent",
  "referer",
  "x-vercel-id",
  "x-forwarded-for",
  "content-type",
  "accept-language",
] as const;

export function sakraHeaders(headers: NodeJS.Dict<string | string[]>): Kontext {
  const ut: Kontext = {};
  for (const namn of SAKRA_HEADERS) {
    const varde = headers[namn];
    if (varde !== undefined) ut[namn] = Array.isArray(varde) ? varde.join(", ") : varde;
  }
  return ut;
}

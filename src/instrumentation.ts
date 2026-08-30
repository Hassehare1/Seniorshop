import { logg, sakraHeaders } from "@/lib/logg";

/**
 * Global felfångst för servern.
 *
 * PROBLEMET: 27 av portalens 32 API-routes saknar try/catch. Kastar en av dem
 * — trasig JSON i anropet, ett unikhetsfel från Prisma, ett oväntat fälttyp —
 * svarar Next med en tom 500 och felet försvinner. Ingen logg, ingen aning om
 * att det hänt.
 *
 * LÖSNINGEN: Next anropar `onRequestError` för VARJE fel servern fångar,
 * oavsett om det uppstod i en route, i en serverkomponent eller i proxyn. Vi
 * får alltså heltäckande felrapportering utan att röra en enda av de 32
 * filerna. Det ersätter inte try/catch där ett fel går att hantera vettigt
 * (den posten står kvar på listan) — men det gör att inget fel längre går
 * obemärkt förbi.
 *
 * Konventionen kräver att filen ligger i roten, eller i `src/` för projekt som
 * har en sådan — därför här och inte i `src/app/`.
 *
 * Signaturen skrivs ut för hand. Next dokumenterar `import { type
 * Instrumentation } from "next"`, men i 16.3.1 exporteras typen inte från
 * paketets toppnivå; den ligger bakom en intern sökväg som kan flytta på sig.
 * Formen nedan är hämtad ur den typen och kontrolleras av Next vid bygget.
 */
export async function onRequestError(
  fel: unknown,
  begaran: Readonly<{
    path: string;
    method: string;
    headers: NodeJS.Dict<string | string[]>;
  }>,
  sammanhang: Readonly<{
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "proxy";
    revalidateReason: "on-demand" | "stale" | undefined;
  }>,
): Promise<void> {
  logg.fel("Ohanterat serverfel", fel, {
    path: begaran.path,
    method: begaran.method,
    routePath: sammanhang.routePath,
    routeType: sammanhang.routeType,
    // Bara tillåtna headers — `cookie` bär hela sessionen. Se lib/logg.ts.
    ...sakraHeaders(begaran.headers),
  });
}

/**
 * Körs en gång när en serverinstans startar. Raden är avsiktligt trivial: den
 * är kvittot på att instrumenteringen ovan faktiskt är inkopplad. Utan den
 * går det inte att skilja "inga fel har inträffat" från "felfångsten laddades
 * aldrig", och det är precis den skillnaden man vill veta.
 *
 * På Vercel betyder det en rad per kallstart, vilket samtidigt ger en gratis
 * bild av hur ofta funktionerna kallstartar.
 */
export function register(): void {
  logg.info("Serverinstans startad", {
    runtime: process.env.NEXT_RUNTIME,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    region: process.env.VERCEL_REGION,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { gallraAuditLog, GALLRING_DAGAR, GALLRING_DAGAR_LOGIN_FAILED } from "@/lib/audit-gallring";
import { logg } from "@/lib/logg";

/**
 * Konstanttidsjämförelse av hemligheten.
 *
 * `!==` avbryter vid första tecken som skiljer, så svarstiden avslöjar i
 * teorin hur många inledande tecken en gissning har rätt. Över HTTP, mot en
 * slumpad token på 32 byte, är det praktiskt taget omöjligt att utnyttja —
 * men kontrollen är gratis, och det är precis den sortens rad en granskare
 * letar efter.
 *
 * Hashen först: `timingSafeEqual` kräver lika långa buffertar och kastar
 * annars, och en längdkontroll före hade läckt just den information vi vill
 * dölja. Två SHA-256-summor är alltid 32 byte.
 */
function likaHemligheter(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
import { medFelhantering } from "@/lib/felhantering";

/**
 * Schemalagd gallring av händelseloggen. Körs av Vercel Cron (se vercel.json),
 * som skickar med Authorization: Bearer $CRON_SECRET.
 *
 * Routen ligger utanför inloggningen — därför måste hemligheten finnas. Saknas
 * CRON_SECRET svarar vi 503 i stället för att gallra oskyddat.
 */
export const GET = medFelhantering(async (req: NextRequest) => {
  const hemlighet = process.env.CRON_SECRET;
  if (!hemlighet) {
    return NextResponse.json({ error: "CRON_SECRET saknas" }, { status: 503 });
  }
  if (!likaHemligheter(req.headers.get("authorization") ?? "", `Bearer ${hemlighet}`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resultat = await gallraAuditLog();

  // Gallringen loggar inte sig själv i AuditLog — ett dagligt jobb som skriver
  // en rad per körning skulle bara fylla tabellen den är satt att tömma.
  // Serverloggen är rätt plats: den gallras av sig själv och går att söka i.
  logg.info("Händelseloggen gallrad", {
    raderadeLoginFailed: resultat.raderadeLoginFailed,
    raderadeOvriga: resultat.raderadeOvriga,
    dagarLoginFailed: GALLRING_DAGAR_LOGIN_FAILED,
    dagarOvriga: GALLRING_DAGAR,
  });

  return NextResponse.json(resultat);
});

import { NextRequest, NextResponse } from "next/server";
import { gallraAuditLog, GALLRING_DAGAR, GALLRING_DAGAR_LOGIN_FAILED } from "@/lib/audit-gallring";

/**
 * Schemalagd gallring av händelseloggen. Körs av Vercel Cron (se vercel.json),
 * som skickar med Authorization: Bearer $CRON_SECRET.
 *
 * Routen ligger utanför inloggningen — därför måste hemligheten finnas. Saknas
 * CRON_SECRET svarar vi 503 i stället för att gallra oskyddat.
 */
export async function GET(req: NextRequest) {
  const hemlighet = process.env.CRON_SECRET;
  if (!hemlighet) {
    return NextResponse.json({ error: "CRON_SECRET saknas" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${hemlighet}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resultat = await gallraAuditLog();

  // Gallringen loggar inte sig själv i AuditLog — ett dagligt jobb som skriver
  // en rad per körning skulle bara fylla tabellen den är satt att tömma.
  console.log(
    `[gallra-logg] raderade ${resultat.raderadeLoginFailed} LOGIN_FAILED (>${GALLRING_DAGAR_LOGIN_FAILED} d) ` +
      `och ${resultat.raderadeOvriga} övriga (>${GALLRING_DAGAR} d)`,
  );

  return NextResponse.json(resultat);
}

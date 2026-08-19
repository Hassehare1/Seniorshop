import { prisma } from "@/lib/prisma";

/**
 * Hur länge händelseloggen sparas.
 *
 * Ett halvår räcker för att i efterhand utreda vem som ändrade vad under en
 * säsong. Misslyckade inloggningar är rent brus i jämförelse — spärren tittar
 * bara 15 minuter bakåt — men en månad kvar räcker för att se ett pågående
 * mönster av försök mot ett konto.
 */
export const GALLRING_DAGAR = 180;
export const GALLRING_DAGAR_LOGIN_FAILED = 30;

const DYGN_MS = 24 * 60 * 60 * 1000;

export type GallringsResultat = {
  raderadeLoginFailed: number;
  raderadeOvriga: number;
};

/**
 * Raderar utgångna poster ur AuditLog. Idempotent — en extra körning gör
 * ingenting, vilket är precis vad man vill av ett schemalagt jobb.
 */
export async function gallraAuditLog(nu: Date = new Date()): Promise<GallringsResultat> {
  const loginGrans = new Date(nu.getTime() - GALLRING_DAGAR_LOGIN_FAILED * DYGN_MS);
  const grans = new Date(nu.getTime() - GALLRING_DAGAR * DYGN_MS);

  const loginFailed = await prisma.auditLog.deleteMany({
    where: { action: "LOGIN_FAILED", createdAt: { lt: loginGrans } },
  });
  const ovriga = await prisma.auditLog.deleteMany({
    where: { action: { not: "LOGIN_FAILED" }, createdAt: { lt: grans } },
  });

  return { raderadeLoginFailed: loginFailed.count, raderadeOvriga: ovriga.count };
}

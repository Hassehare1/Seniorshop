import { prisma } from "@/lib/prisma";

// Tidsbegränsad brytare: när den är på kan admin REA-märka besök i redan
// godkända veckor (se PATCH /api/reports/[id]/visits/[visitId]). Av som
// standard — måste slås på aktivt inför en efterhandsrättning, och stängas
// när alla FT hunnit gå igenom sina veckor. Se [[rea-besok]] i minnet.
const KEY = "rea_backfill_enabled";

export async function isReaBackfillEnabled(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({ where: { key: KEY } });
  return setting?.value === "true";
}

export async function setReaBackfillEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: String(enabled) },
    update: { value: String(enabled) },
  });
}

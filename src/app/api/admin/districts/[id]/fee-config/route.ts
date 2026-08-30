import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { STANDARD_FEE_CONFIG } from "@/lib/fees";
import { las, z, andel, belopp } from "@/lib/validering";
import { medFelhantering } from "@/lib/felhantering";

/**
 * Avgiftsvillkoren avgör vad varje franchisetagare faktiskt faktureras, och
 * routen tog tidigare emot dem HELT ovaliderat: en sats på 999 eller ett
 * negativt tak gick rakt in i databasen och räknade om alla kommande besök.
 *
 * Fälten är frivilliga var för sig — formuläret skickar dem det ändrat.
 */
const Schema = z.object({
  ftFeePercent: andel("FT-avgiften").optional(),
  mfFeePercent: andel("MF-avgiften").optional(),
  mfFeeCap: belopp("MF-taket").max(1_000_000, "MF-taket är orimligt högt.").optional(),
  // Momsfaktor: 1,25 = 25 %. Under 1 vore moms som drar av, över 2 finns inte.
  vatMultiplier: z.coerce
    .number({ error: "Momsfaktorn måste vara ett tal." })
    .min(1, "Momsfaktorn kan inte vara lägre än 1 (1,25 = 25 % moms).")
    .max(2, "Momsfaktorn kan inte vara högre än 2.")
    .optional(),
});

export const PUT = medFelhantering(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id: districtId } = await params;
  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { ftFeePercent, mfFeePercent, mfFeeCap, vatMultiplier } = data;

  const district = await prisma.district.findUnique({
    where: { id: districtId },
    select: { number: true, name: true },
  });

  const updated = await prisma.feeConfig.upsert({
    where: { districtId },
    update: {
      ...(ftFeePercent !== undefined && { ftFeePercent }),
      ...(mfFeePercent !== undefined && { mfFeePercent }),
      ...(mfFeeCap !== undefined && { mfFeeCap }),
      ...(vatMultiplier !== undefined && { vatMultiplier }),
      updatedBy: session.user.email ?? session.user.id,
    },
    create: {
      districtId,
      ftFeePercent: ftFeePercent ?? STANDARD_FEE_CONFIG.ftFeePercent,
      mfFeePercent: mfFeePercent ?? STANDARD_FEE_CONFIG.mfFeePercent,
      mfFeeCap: mfFeeCap ?? STANDARD_FEE_CONFIG.mfFeeCap,
      vatMultiplier: vatMultiplier ?? STANDARD_FEE_CONFIG.vatMultiplier,
      updatedBy: session.user.email ?? session.user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "AVGIFTER_UPPDATERADE",
      entity: "FeeConfig",
      entityId: districtId,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
      details: JSON.stringify({ ftFeePercent, mfFeePercent, mfFeeCap, vatMultiplier, districtNr: district?.number, districtName: district?.name }),
    },
  });

  return NextResponse.json(updated);
});

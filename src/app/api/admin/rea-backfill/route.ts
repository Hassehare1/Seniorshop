import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { isReaBackfillEnabled, setReaBackfillEnabled } from "@/lib/reaBackfill";
import { las, z, boolean } from "@/lib/validering";

const Schema = z.object({ enabled: boolean("Brytaren") });

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  return NextResponse.json({ enabled: await isReaBackfillEnabled() });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { enabled } = data;

  await setReaBackfillEnabled(enabled);

  await prisma.auditLog.create({
    data: {
      action: enabled ? "REA_EFTERHANDSANDRING_PA" : "REA_EFTERHANDSANDRING_AV",
      entity: "AppSetting",
      entityId: "rea_backfill_enabled",
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
    },
  });

  return NextResponse.json({ enabled });
}

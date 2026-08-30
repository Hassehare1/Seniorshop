import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { medFelhantering } from "@/lib/felhantering";

export const PATCH = medFelhantering(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id: districtId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Namn krävs." }, { status: 400 });

  const existing = await prisma.district.findUnique({ where: { id: districtId }, select: { name: true } });
  if (!existing) return NextResponse.json({ error: "Distriktet hittades inte." }, { status: 404 });

  const updated = await prisma.district.update({
    where: { id: districtId },
    data: { name },
  });

  if (existing.name !== name) {
    await prisma.auditLog.create({
      data: {
        action: "DISTRIKT_ÄNDRAT",
        entity: "District",
        entityId: districtId,
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? null,
        details: JSON.stringify({ från: existing.name, till: name }),
      },
    });
  }

  return NextResponse.json(updated);
});

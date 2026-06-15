import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, type, contactPerson, phone, address, notes, active } = body;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Kund hittades inte" }, { status: 404 });

  if (session.user.role !== "ADMIN" && session.user.districtId !== customer.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(notes !== undefined && { notes }),
      ...(active !== undefined && { active }),
    },
  });

  const district = await prisma.district.findUnique({
    where: { id: updated.districtId },
    select: { number: true, name: true },
  });
  await prisma.auditLog.create({
    data: {
      action: "KUND_ÄNDRAD",
      entity: "Customer",
      entityId: updated.id,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
      details: JSON.stringify({
        namn: updated.name,
        typ: updated.type,
        status: updated.active ? "aktiv" : "inaktiv",
        districtNr: district?.number,
        districtName: district?.name,
      }),
    },
  });

  return NextResponse.json(updated);
}

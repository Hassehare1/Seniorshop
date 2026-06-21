import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await params;
  const body = await req.json();
  const { name, type, contactPerson, contactRole, email, phone, address, size, notes, active } = body;

  // Tål id med svenska tecken (URL-kodning + NFC/NFD)
  let decoded = rawId;
  try { decoded = decodeURIComponent(rawId); } catch { /* lämna oavkodat */ }
  const idCandidates = Array.from(new Set([decoded, decoded.normalize("NFC"), decoded.normalize("NFD")]));

  const customer = await prisma.customer.findFirst({ where: { id: { in: idCandidates } } });
  if (!customer) return NextResponse.json({ error: "Kund hittades inte" }, { status: 404 });

  if (session.user.role !== "ADMIN" && session.user.districtId !== customer.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let parsedSize: number | null | undefined = undefined;
  if (size !== undefined) {
    parsedSize = size === "" || size === null ? null : Number(size);
    if (parsedSize !== null && (!Number.isFinite(parsedSize) || parsedSize < 0)) {
      return NextResponse.json({ error: "Storlek måste vara ett positivt tal" }, { status: 400 });
    }
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(contactRole !== undefined && { contactRole }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(parsedSize !== undefined && { size: parsedSize }),
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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const districtId =
    session.user.role === "ADMIN"
      ? new URL(req.url).searchParams.get("districtId") || undefined
      : session.user.districtId ?? undefined;

  const customers = await prisma.customer.findMany({
    where: { ...(districtId ? { districtId } : {}), active: true },
    include: { district: { select: { number: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, type, contactPerson, phone, address, notes, districtId } = body;

  const targetDistrictId =
    session.user.role === "ADMIN" ? districtId : session.user.districtId;

  if (!targetDistrictId || !name || !type) {
    return NextResponse.json({ error: "Saknade fält" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: { name, type, contactPerson, phone, address, notes, districtId: targetDistrictId },
  });

  const district = await prisma.district.findUnique({
    where: { id: targetDistrictId },
    select: { number: true, name: true },
  });
  await prisma.auditLog.create({
    data: {
      action: "KUND_SKAPAD",
      entity: "Customer",
      entityId: customer.id,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
      details: JSON.stringify({
        namn: customer.name,
        typ: customer.type,
        districtNr: district?.number,
        districtName: district?.name,
      }),
    },
  });

  return NextResponse.json(customer, { status: 201 });
}

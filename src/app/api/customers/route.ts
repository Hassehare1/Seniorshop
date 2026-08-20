import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerType } from "@prisma/client";
import { normalizePostalCode, validatePostalCode } from "@/lib/postalCode";
import { parseAntal } from "@/lib/salesMaterial";

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
  const { name, type, contactPerson, contactRole, email, phone, address, postalCode, city, notes, districtId,
    postersA3, postersA4, digitalMaterial, digitalMaterialNote } = body;

  const targetDistrictId =
    session.user.role === "ADMIN" ? districtId : session.user.districtId;

  if (!targetDistrictId || !name || !type) {
    return NextResponse.json({ error: "Saknade fält" }, { status: 400 });
  }
  if (!Object.values(CustomerType).includes(type)) {
    return NextResponse.json({ error: "Ogiltig kundtyp." }, { status: 400 });
  }

  // Distriktet hämtas före skapandet — regionen avgör hur många siffror
  // postnumret ska ha, och samma uppslag återanvänds i audit-loggen.
  const district = await prisma.district.findUnique({
    where: { id: targetDistrictId },
    select: { number: true, name: true, region: true },
  });

  const postalCodeError = validatePostalCode(String(postalCode ?? ""), district?.region);
  if (postalCodeError) {
    return NextResponse.json({ error: postalCodeError }, { status: 400 });
  }

  const maxNr = await prisma.customer.aggregate({
    where: { districtId: targetDistrictId },
    _max: { customerNumber: true },
  });
  const customer = await prisma.customer.create({
    data: {
      name, type, contactPerson, contactRole, email, phone, address, notes,
      postersA3: parseAntal(postersA3),
      postersA4: parseAntal(postersA4),
      digitalMaterial: !!digitalMaterial,
      digitalMaterialNote: String(digitalMaterialNote ?? "").trim() || null,
      postalCode: normalizePostalCode(String(postalCode ?? "")) || null,
      city: String(city ?? "").trim() || null,
      districtId: targetDistrictId,
      customerNumber: (maxNr._max.customerNumber ?? 0) + 1,
    },
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

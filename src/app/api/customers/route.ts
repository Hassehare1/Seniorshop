import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { CustomerType } from "@prisma/client";
import { normalizePostalCode, validatePostalCode } from "@/lib/postalCode";
import { las, z, id, text, valfriText, antal, boolean, moteslokal, enumFalt } from "@/lib/validering";

/**
 * Kundens fält. Fritexten gick tidigare rakt in i Prisma utan typkontroll
 * eller längdgräns — ett namn kunde vara ett objekt och en notering hur lång
 * som helst.
 *
 * Postnumret valideras INTE här: dess längd beror på distriktets region
 * (5 för SE/FI, 4 för DK), vilket kräver ett databasuppslag. Den kontrollen
 * ligger kvar i routen, efter att distriktet hämtats.
 */
export const KundFalt = {
  name: text("Kundnamnet", 200),
  type: enumFalt(CustomerType, "Kundtypen"),
  contactPerson: valfriText("Kontaktperson", 120),
  contactRole: valfriText("Kontaktpersonens roll", 120),
  email: valfriText("E-postadressen", 200),
  phone: valfriText("Telefonnumret", 40),
  address: valfriText("Adressen", 200),
  city: valfriText("Postorten", 100),
  notes: valfriText("Noteringen", 4000),
  venue: moteslokal,
  postersA3: antal("Antal A3", 10_000),
  postersA4: antal("Antal A4", 10_000),
  digitalMaterial: boolean("Digitalt material"),
  digitalMaterialNote: valfriText("Noteringen om digitalt material", 200),
} as const;

const SkapaSchema = z.object({
  ...KundFalt,
  districtId: id("Distrikt-id").optional(),
  // Postnumret kollas mot regionen längre ned; här bara att det är text.
  postalCode: valfriText("Postnumret", 20),
  postersA3: KundFalt.postersA3.default(0),
  postersA4: KundFalt.postersA4.default(0),
  digitalMaterial: KundFalt.digitalMaterial.default(false),
});

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

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
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const data = await las(req, SkapaSchema);
  if (data instanceof Response) return data;
  const { name, type, contactPerson, contactRole, email, phone, address, postalCode, city, notes, districtId,
    postersA3, postersA4, digitalMaterial, digitalMaterialNote, venue } = data;

  const targetDistrictId =
    session.user.role === "ADMIN" ? districtId : session.user.districtId;

  if (!targetDistrictId) {
    return NextResponse.json({ error: "Distrikt saknas." }, { status: 400 });
  }

  // Distriktet hämtas före skapandet — regionen avgör hur många siffror
  // postnumret ska ha, och samma uppslag återanvänds i audit-loggen.
  const district = await prisma.district.findUnique({
    where: { id: targetDistrictId },
    select: { number: true, name: true, region: true },
  });

  const postalCodeError = validatePostalCode(postalCode ?? "", district?.region);
  if (postalCodeError) {
    return NextResponse.json({ error: postalCodeError }, { status: 400 });
  }

  const maxNr = await prisma.customer.aggregate({
    where: { districtId: targetDistrictId },
    _max: { customerNumber: true },
  });
  // Fälten är redan trimmade, typkontrollerade och tom-sträng-till-null:ade
  // av schemat — därför inga String()/!!/parseAntal-krumbukter här längre.
  const customer = await prisma.customer.create({
    data: {
      name, type, contactPerson, contactRole, email, phone, address, notes,
      venue, city, postersA3, postersA4, digitalMaterial, digitalMaterialNote,
      postalCode: normalizePostalCode(postalCode ?? "") || null,
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

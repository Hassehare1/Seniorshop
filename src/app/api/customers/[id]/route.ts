import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { normalizePostalCode, validatePostalCode } from "@/lib/postalCode";
import { las, z, valfriText, boolean } from "@/lib/validering";
import { KundFalt } from "../route";
import { medFelhantering } from "@/lib/felhantering";

/**
 * Delvis uppdatering: fälten återanvänds från KundFalt i ../route.ts, så att
 * ett kundnamns längdgräns bara står på ett ställe. Allt är frivilligt —
 * utelämnat fält lämnas orört, vilket spreadarna längre ned bygger på.
 */
const Schema = z.object({
  name: KundFalt.name.optional(),
  type: KundFalt.type.optional(),
  contactPerson: KundFalt.contactPerson.optional(),
  contactRole: KundFalt.contactRole.optional(),
  email: KundFalt.email.optional(),
  phone: KundFalt.phone.optional(),
  address: KundFalt.address.optional(),
  city: KundFalt.city.optional(),
  notes: KundFalt.notes.optional(),
  venue: KundFalt.venue.optional(),
  postersA3: KundFalt.postersA3.optional(),
  postersA4: KundFalt.postersA4.optional(),
  digitalMaterial: KundFalt.digitalMaterial.optional(),
  digitalMaterialNote: KundFalt.digitalMaterialNote.optional(),
  postalCode: valfriText("Postnumret", 20).optional(),
  active: boolean("Aktiv-flaggan").optional(),
});

export const PATCH = medFelhantering(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id: rawId } = await params;
  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { name, type, contactPerson, contactRole, email, phone, address, postalCode, city, notes, active,
    postersA3, postersA4, digitalMaterial, digitalMaterialNote, venue } = data;

  // Tål id med svenska tecken (URL-kodning + NFC/NFD)
  let decoded = rawId;
  try { decoded = decodeURIComponent(rawId); } catch { /* lämna oavkodat */ }
  const idCandidates = Array.from(new Set([decoded, decoded.normalize("NFC"), decoded.normalize("NFD")]));

  const customer = await prisma.customer.findFirst({ where: { id: { in: idCandidates } } });
  if (!customer) return NextResponse.json({ error: "Kund hittades inte" }, { status: 404 });

  if (session.user.role !== "ADMIN" && session.user.districtId !== customer.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Antal siffror i postnumret följer distriktets region — den enda kontroll
  // som kräver ett databasuppslag och därför inte kan bo i schemat.
  if (postalCode !== undefined) {
    const district = await prisma.district.findUnique({
      where: { id: customer.districtId },
      select: { region: true },
    });
    const postalCodeError = validatePostalCode(postalCode ?? "", district?.region);
    if (postalCodeError) {
      return NextResponse.json({ error: postalCodeError }, { status: 400 });
    }
  }

  // Värdena är redan trimmade och typkontrollerade av schemat. Spreadarna
  // finns kvar eftersom de bär skillnaden mellan "utelämnat" och "satt".
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
      ...(city !== undefined && { city }),
      ...(postalCode !== undefined && {
        postalCode: normalizePostalCode(postalCode ?? "") || null,
      }),
      ...(notes !== undefined && { notes }),
      ...(venue !== undefined && { venue }),
      ...(postersA3 !== undefined && { postersA3 }),
      ...(postersA4 !== undefined && { postersA4 }),
      ...(digitalMaterial !== undefined && { digitalMaterial }),
      ...(digitalMaterialNote !== undefined && { digitalMaterialNote }),
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
});

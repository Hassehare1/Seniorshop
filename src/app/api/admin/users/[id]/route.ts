import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { las, z, id as idFalt, valfriText, epost, losenord, boolean, enumFalt } from "@/lib/validering";

/**
 * Delvis uppdatering: varje fält är frivilligt, och ett utelämnat fält
 * lämnas orört. Skillnaden mellan "utelämnat" och "satt till null" bärs av
 * `undefined` — JSON kan inte uttrycka undefined, så ett fält som finns i
 * kroppen är alltid ett medvetet val från klienten.
 */
const Schema = z.object({
  name: valfriText("Namn", 120).optional(),
  email: epost.optional(),
  password: losenord.optional(),
  role: enumFalt(Role, "Rollen").optional(),
  districtId: idFalt("Distrikt-id").nullish(),
  active: boolean("Spärrstatus").optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { name, email, password, role, districtId, active } = data;
  // Ersätter `"districtId" in body`: fältet finns i kroppen eller inte.
  const districtIdSkickat = districtId !== undefined;

  // Hämta nuvarande tillstånd för att kunna logga vad som ändrades
  const before = await prisma.user.findUnique({
    where: { id },
    include: { district: { select: { number: true, name: true } } },
  });
  if (!before) return NextResponse.json({ error: "Användare hittades inte" }, { status: 404 });

  // Hindra admin från att spärra eller degradera sitt eget konto (lås-ute-skydd)
  if (id === session.user.id) {
    if (active === false) {
      return NextResponse.json({ error: "Du kan inte spärra ditt eget konto." }, { status: 400 });
    }
    if (role !== undefined && role !== "ADMIN") {
      return NextResponse.json({ error: "Du kan inte ta bort din egen admin-roll." }, { status: 400 });
    }
  }

  // Slutläget måste vara konsekvent: en franchisetagare måste ha ett distrikt
  const effectiveRole = role !== undefined ? role : before.role;
  const effectiveDistrictId = districtIdSkickat ? (districtId || null) : before.districtId;
  if (effectiveRole === "FRANCHISEE" && !effectiveDistrictId) {
    return NextResponse.json({ error: "En franchisetagare måste vara kopplad till ett distrikt." }, { status: 400 });
  }

  const uppdatering: Record<string, unknown> = {};
  if (name !== undefined) uppdatering.name = name || null;
  if (email !== undefined) uppdatering.email = email;
  if (role !== undefined) uppdatering.role = role;
  if (districtIdSkickat) uppdatering.districtId = districtId || null;
  if (active !== undefined) uppdatering.active = active;
  if (password) uppdatering.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id },
    data: uppdatering,
    include: { district: { select: { number: true, name: true } } },
  });

  // Logga ändringar — särskilt säkerhetskänsliga (roll, distrikt, spärr, lösenord)
  const changes: Record<string, unknown> = {};
  if (role !== undefined && role !== before.role) changes.roll = `${before.role} → ${role}`;
  if (districtIdSkickat && (districtId || null) !== before.districtId) {
    changes.distrikt = `${before.district ? `D${before.district.number}` : "–"} → ${user.district ? `D${user.district.number} – ${user.district.name}` : "–"}`;
  }
  if (active !== undefined && active !== before.active) changes.spärr = active ? "upplåst" : "SPÄRRAD";
  if (password) changes.lösenord = "ändrat";
  if (email !== undefined && email !== before.email) changes.email = `${before.email} → ${email}`;

  if (Object.keys(changes).length > 0) {
    await prisma.auditLog.create({
      data: {
        action: "ANVÄNDARE_ÄNDRAD",
        entity: "User",
        entityId: id,
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? null,
        details: JSON.stringify({ konto: user.email, ...changes }),
      },
    });
  }

  // Returnera aldrig lösenordshash till klienten
  const { passwordHash: _ph, ...safeUser } = user;
  return NextResponse.json(safeUser);
}

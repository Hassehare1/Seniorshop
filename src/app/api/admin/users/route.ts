import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { las, z, id, valfriText, epost, losenord, enumFalt } from "@/lib/validering";

// epost normaliserar (trim + gemener) och kontrollerar formatet — tidigare
// gjordes bara trim/gemener, så "anna" utan snabel-a gick igenom.
const Schema = z
  .object({
    name: valfriText("Namn", 120),
    email: epost,
    password: losenord,
    role: enumFalt(Role, "Rollen"),
    districtId: id("Distrikt-id").nullish(),
  })
  .refine((u) => u.role !== "FRANCHISEE" || !!u.districtId, {
    error: "En franchisetagare måste kopplas till ett distrikt.",
    path: ["districtId"],
  });

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { name, email, password, role, districtId } = data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "E-postadressen används redan" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name: name || null,
      email,
      passwordHash,
      role,
      districtId: districtId || null,
    },
    include: { district: { select: { number: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      action: "ANVÄNDARE_SKAPAD",
      entity: "User",
      entityId: user.id,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
      details: JSON.stringify({
        email: user.email,
        roll: user.role,
        distrikt: user.district ? `D${user.district.number} – ${user.district.name}` : null,
      }),
    },
  });

  // Returnera aldrig lösenordshash till klienten
  const { passwordHash: _ph, ...safeUser } = user;
  return NextResponse.json(safeUser, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, email, password, role, districtId, active } = body;

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

  if (role !== undefined && !Object.values(Role).includes(role)) {
    return NextResponse.json({ error: "Ogiltig roll." }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ error: "Lösenordet måste vara minst 6 tecken." }, { status: 400 });
  }
  // Slutläget måste vara konsekvent: en franchisetagare måste ha ett distrikt
  const effectiveRole = role !== undefined ? role : before.role;
  const effectiveDistrictId = "districtId" in body ? (districtId || null) : before.districtId;
  if (effectiveRole === "FRANCHISEE" && !effectiveDistrictId) {
    return NextResponse.json({ error: "En franchisetagare måste vara kopplad till ett distrikt." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name || null;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if ("districtId" in body) data.districtId = districtId || null;
  if (active !== undefined) data.active = !!active;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id },
    data,
    include: { district: { select: { number: true, name: true } } },
  });

  // Logga ändringar — särskilt säkerhetskänsliga (roll, distrikt, spärr, lösenord)
  const changes: Record<string, unknown> = {};
  if (role !== undefined && role !== before.role) changes.roll = `${before.role} → ${role}`;
  if ("districtId" in body && (districtId || null) !== before.districtId) {
    changes.distrikt = `${before.district ? `D${before.district.number}` : "–"} → ${user.district ? `D${user.district.number} – ${user.district.name}` : "–"}`;
  }
  if (active !== undefined && !!active !== before.active) changes.spärr = active ? "upplåst" : "SPÄRRAD";
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

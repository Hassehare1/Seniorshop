import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email: rawEmail, password, role, districtId } = await req.json();
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail;
  if (!email || !password || !role) {
    return NextResponse.json({ error: "Saknade fält" }, { status: 400 });
  }
  if (!Object.values(Role).includes(role)) {
    return NextResponse.json({ error: "Ogiltig roll." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Lösenordet måste vara minst 6 tecken." }, { status: 400 });
  }
  if (role === "FRANCHISEE" && !districtId) {
    return NextResponse.json({ error: "En franchisetagare måste kopplas till ett distrikt." }, { status: 400 });
  }

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

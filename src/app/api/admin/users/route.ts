import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, password, role, districtId } = await req.json();
  if (!email || !password || !role) {
    return NextResponse.json({ error: "Saknade fält" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "E-postadressen används redan" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
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

  // Returnera aldrig lösenordshash till klienten
  const { passwordHash: _ph, ...safeUser } = user;
  return NextResponse.json(safeUser, { status: 201 });
}

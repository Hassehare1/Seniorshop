import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, email, password, role, districtId } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name || null;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if ("districtId" in body) data.districtId = districtId || null;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    include: { district: { select: { number: true, name: true } } },
  });

  return NextResponse.json(user);
}

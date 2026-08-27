import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const { weekStart, weekEnd } = await req.json();

  if (weekStart >= weekEnd) {
    return NextResponse.json({ error: "Startvecka måste vara före slutvecka" }, { status: 400 });
  }

  const updated = await prisma.season.update({
    where: { id },
    data: { weekStart: Number(weekStart), weekEnd: Number(weekEnd) },
    include: { _count: { select: { reports: true } } },
  });

  return NextResponse.json(updated);
}

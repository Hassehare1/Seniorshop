import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const seasons = await prisma.season.findMany({ orderBy: [{ year: "desc" }, { type: "desc" }] });
  return NextResponse.json(seasons);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { type, year, weekStart, weekEnd } = await req.json();
  if (!type || !year || !weekStart || !weekEnd) {
    return NextResponse.json({ error: "Saknade fält" }, { status: 400 });
  }
  if (weekStart >= weekEnd) {
    return NextResponse.json({ error: "Startvecka måste vara före slutvecka" }, { status: 400 });
  }

  const existing = await prisma.season.findUnique({
    where: { type_year: { type, year: Number(year) } },
  });
  if (existing) {
    return NextResponse.json({ error: "Säsongen finns redan", existingId: existing.id }, { status: 409 });
  }

  const season = await prisma.season.create({
    data: { type, year: Number(year), weekStart: Number(weekStart), weekEnd: Number(weekEnd) },
  });
  return NextResponse.json(season, { status: 201 });
}

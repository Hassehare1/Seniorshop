import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { las, z, veckonummer } from "@/lib/validering";
import { medFelhantering } from "@/lib/felhantering";

// Samma spann-regel som när säsongen skapas. Se SasongSchema i ../route.ts —
// den kan inte återanvändas rakt av här, eftersom type och year inte ändras.
const Schema = z
  .object({
    weekStart: veckonummer("Startvecka"),
    weekEnd: veckonummer("Slutvecka"),
  })
  .refine((s) => s.weekStart < s.weekEnd, {
    error: "Startveckan måste ligga före slutveckan.",
    path: ["weekStart"],
  });

export const PATCH = medFelhantering(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const data = await las(req, Schema);
  if (data instanceof Response) return data;

  const updated = await prisma.season.update({
    where: { id },
    data: { weekStart: data.weekStart, weekEnd: data.weekEnd },
    include: { _count: { select: { reports: true } } },
  });

  return NextResponse.json(updated);
});

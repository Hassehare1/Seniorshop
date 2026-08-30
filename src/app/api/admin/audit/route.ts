import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { medFelhantering } from "@/lib/felhantering";

export const GET = medFelhantering(async (req: NextRequest) => {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
});

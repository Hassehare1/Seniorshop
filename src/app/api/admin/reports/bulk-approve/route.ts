import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Godkänn alla SUBMITTED-rapporter (optionellt filtrerat på säsong)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { seasonId } = await req.json();

  const result = await prisma.weeklyReport.updateMany({
    where: {
      status: "SUBMITTED",
      ...(seasonId ? { seasonId } : {}),
    },
    data: { status: "APPROVED" },
  });

  return NextResponse.json({ approved: result.count });
}

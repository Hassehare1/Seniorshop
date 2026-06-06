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

  // Hämta rapporterna som ska godkännas för audit-loggning
  const toApprove = await prisma.weeklyReport.findMany({
    where: { status: "SUBMITTED", ...(seasonId ? { seasonId } : {}) },
    include: { district: { select: { number: true, name: true } } },
  });

  const result = await prisma.weeklyReport.updateMany({
    where: {
      status: "SUBMITTED",
      ...(seasonId ? { seasonId } : {}),
    },
    data: { status: "APPROVED" },
  });

  // Logga varje godkänd rapport
  if (toApprove.length > 0) {
    await prisma.auditLog.createMany({
      data: toApprove.map(r => ({
        action: "RAPPORT_GODKÄND",
        entity: "WeeklyReport",
        entityId: r.id,
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? null,
        details: JSON.stringify({
          från: "SUBMITTED",
          till: "APPROVED",
          districtId: r.districtId,
          districtNr: r.district.number,
          districtName: r.district.name,
          vecka: r.week,
          bulk: true,
        }),
      })),
    });
  }

  return NextResponse.json({ approved: result.count });
}

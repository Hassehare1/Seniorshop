import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { las, z, id } from "@/lib/validering";
import { medFelhantering } from "@/lib/felhantering";

// seasonId spreds tidigare orört in i Prismas `where`. Ett objekt i stället
// för en sträng — `{ seasonId: { not: "x" } }` — blir då ett FILTER och inte
// ett id, alltså något helt annat än vad routen menar. Admin-låst, så ingen
// behörighetslucka, men schemat gör att bara ett id kan komma in.
const Schema = z.object({ seasonId: id("Säsongs-id").optional() });

// Godkänn alla SUBMITTED-rapporter (optionellt filtrerat på säsong)
export const POST = medFelhantering(async (req: NextRequest) => {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { seasonId } = data;

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
});

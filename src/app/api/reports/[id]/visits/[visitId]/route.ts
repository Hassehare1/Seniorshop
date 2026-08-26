import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReaBackfillEnabled } from "@/lib/reaBackfill";

// Smalt undantag från rapportlåsningen: bara isSale, bara admin, bara medan
// brytaren i AppSetting är på. Försäljning, kundantal och kommentar går
// fortfarande INTE att ändra på en godkänd rapport — se PATCH .../status
// för den vanliga vägen. Se [[rea-besok]] i minnet för bakgrunden.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; visitId: string }> },
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!(await isReaBackfillEnabled())) {
    return NextResponse.json(
      { error: "REA-ändring i efterhand är avstängd just nu" },
      { status: 403 },
    );
  }

  const { id, visitId } = await params;
  const { isSale } = await req.json();
  if (typeof isSale !== "boolean") {
    return NextResponse.json({ error: "isSale måste vara sant eller falskt" }, { status: 400 });
  }

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      customer: { select: { name: true } },
      report: { include: { district: { select: { number: true, name: true } } } },
    },
  });
  if (!visit || visit.reportId !== id) {
    return NextResponse.json({ error: "Besök hittades inte" }, { status: 404 });
  }
  if (visit.isSale === isSale) {
    return NextResponse.json({ id: visit.id, isSale });
  }

  await prisma.visit.update({ where: { id: visitId }, data: { isSale } });

  await prisma.auditLog.create({
    data: {
      action: isSale ? "REA_MARKERAD" : "REA_AVMARKERAD",
      entity: "Visit",
      entityId: visitId,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
      details: JSON.stringify({
        kund: visit.customer.name,
        vecka: visit.report.week,
        districtNr: visit.report.district.number,
        districtName: visit.report.district.name,
        rapportStatus: visit.report.status,
      }),
    },
  });

  return NextResponse.json({ id: visit.id, isSale });
}

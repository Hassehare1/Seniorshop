import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ReportStatus } from "@prisma/client";
import { las, z, enumFalt } from "@/lib/validering";

const Schema = z.object({ status: enumFalt(ReportStatus, "Statusen") });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const newStatus = data.status;
  const isAdmin = session.user.role === "ADMIN";

  const report = await prisma.weeklyReport.findUnique({
    where: { id },
    include: { district: { select: { number: true, name: true } } },
  });
  if (!report) return NextResponse.json({ error: "Rapport hittades inte" }, { status: 404 });

  if (!isAdmin && session.user.districtId !== report.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = report.status;

  // Admin får sätta vilken status som helst; schemat har redan avvisat allt
  // som inte är en giltig status. FT får bara lämna in och ta tillbaka.
  const allowed = isAdmin
    ? true
    : (current === "DRAFT" && newStatus === "SUBMITTED") ||
      (current === "SUBMITTED" && newStatus === "DRAFT");

  if (!allowed) {
    return NextResponse.json(
      { error: "Du har inte behörighet att göra denna statusändring" },
      { status: 403 }
    );
  }

  const updated = await prisma.weeklyReport.update({
    where: { id },
    data: { status: newStatus as "DRAFT" | "SUBMITTED" | "APPROVED" },
  });

  const actionMap: Record<string, string> = {
    SUBMITTED: "RAPPORT_INLÄMNAD",
    APPROVED: "RAPPORT_GODKÄND",
    DRAFT: current === "APPROVED" ? "RAPPORT_UPPLÅST_ADMIN" : "RAPPORT_UPPLÅST",
  };

  await prisma.auditLog.create({
    data: {
      action: actionMap[newStatus] ?? newStatus,
      entity: "WeeklyReport",
      entityId: id,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
      details: JSON.stringify({
        från: current,
        till: newStatus,
        districtId: report.districtId,
        districtNr: report.district.number,
        districtName: report.district.name,
        vecka: report.week,
      }),
    },
  });

  return NextResponse.json(updated);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status: newStatus } = await req.json();
  const isAdmin = session.user.role === "ADMIN";

  const report = await prisma.weeklyReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Rapport hittades inte" }, { status: 404 });

  if (!isAdmin && session.user.districtId !== report.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = report.status;

  const allowed = isAdmin
    ? ["DRAFT", "SUBMITTED", "APPROVED"].includes(newStatus)
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
        vecka: report.week,
      }),
    },
  });

  return NextResponse.json(updated);
}

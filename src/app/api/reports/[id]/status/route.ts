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

  // FT kan bara ändra sin egen rapport
  if (!isAdmin && session.user.districtId !== report.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = report.status;

  // Behörighetsmatris
  const allowed = isAdmin
    ? ["DRAFT", "SUBMITTED", "APPROVED"].includes(newStatus)           // admin kan sätta vad som helst
    : (current === "DRAFT" && newStatus === "SUBMITTED") ||            // FT låser
      (current === "SUBMITTED" && newStatus === "DRAFT");              // FT låser upp (ej APPROVED)

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

  return NextResponse.json(updated);
}

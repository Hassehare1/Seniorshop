import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const submittedCount = await prisma.weeklyReport.count({
    where: { status: "SUBMITTED" },
  });

  return NextResponse.json({ submittedCount });
}

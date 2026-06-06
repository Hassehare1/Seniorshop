import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const submittedCount = await prisma.weeklyReport.count({
    where: { status: "SUBMITTED" },
  });

  return NextResponse.json({ submittedCount });
}

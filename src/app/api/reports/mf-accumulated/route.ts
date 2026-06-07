import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");
  const week = Number(searchParams.get("week") ?? 99);

  // FT kan bara hämta sitt eget distrikt — admin kan ange valfritt
  const districtId =
    session.user.role === "ADMIN"
      ? searchParams.get("districtId")
      : session.user.districtId ?? null;

  if (!districtId || !seasonId) {
    return NextResponse.json({ accumulated: 0 });
  }

  const reports = await prisma.weeklyReport.findMany({
    where: { districtId, seasonId, week: { lt: week } },
    include: { visits: { select: { mfFee: true } } },
  });

  const accumulated = reports
    .flatMap((r) => r.visits)
    .reduce((s, v) => s + v.mfFee, 0);

  return NextResponse.json({ accumulated });
}

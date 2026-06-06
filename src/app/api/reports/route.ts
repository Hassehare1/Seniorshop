import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { districtId, seasonId, week, visits } = body;

  if (session.user.role !== "ADMIN" && session.user.districtId !== districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: "Session saknar user id" }, { status: 401 });

  // Skydda godkända rapporter från att skrivas över
  const existing = await prisma.weeklyReport.findUnique({
    where: { districtId_seasonId_week: { districtId, seasonId, week } },
    select: { status: true },
  });
  if (existing?.status === "APPROVED") {
    return NextResponse.json(
      { error: "Rapporten är godkänd av admin och kan inte ändras. Kontakta admin." },
      { status: 403 }
    );
  }

  const report = await prisma.weeklyReport.upsert({
    where: { districtId_seasonId_week: { districtId, seasonId, week } },
    update: { status: "DRAFT", updatedAt: new Date() },
    create: {
      district: { connect: { id: districtId } },
      season: { connect: { id: seasonId } },
      week,
      user: { connect: { id: userId } },
      status: "DRAFT",
    },
  });

  await prisma.visit.deleteMany({ where: { reportId: report.id } });

  await prisma.visit.createMany({
    data: visits.map((v: any) => ({
      reportId: report.id,
      customerId: v.customerId,
      numberOfCustomers: v.numberOfCustomers,
      sales: v.sales,
      isFashionShow: v.isFashionShow,
      fashionShowSales: v.fashionShowSales,
      ftFee: v.ftFee,
      mfFee: v.mfFee,
      mfFeeAccumulated: v.mfFeeAccumulated,
      totalToPay: v.totalToPay,
      comment: v.comment || null,
    })),
  });

  return NextResponse.json({ id: report.id });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");
  const districtId =
    session.user.role === "ADMIN"
      ? searchParams.get("districtId") || undefined
      : session.user.districtId ?? undefined;

  const reports = await prisma.weeklyReport.findMany({
    where: {
      ...(seasonId ? { seasonId } : {}),
      ...(districtId ? { districtId } : {}),
    },
    include: { visits: { include: { customer: true } }, district: true },
    orderBy: { week: "asc" },
  });

  return NextResponse.json(reports);
}

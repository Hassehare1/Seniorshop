import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: districtId } = await params;
  const body = await req.json();
  const { ftFeePercent, mfFeePercent, mfFeeCap, vatMultiplier } = body;

  const updated = await prisma.feeConfig.upsert({
    where: { districtId },
    update: {
      ...(ftFeePercent !== undefined && { ftFeePercent }),
      ...(mfFeePercent !== undefined && { mfFeePercent }),
      ...(mfFeeCap !== undefined && { mfFeeCap }),
      ...(vatMultiplier !== undefined && { vatMultiplier }),
      updatedBy: session.user.email ?? session.user.id,
    },
    create: {
      districtId,
      ftFeePercent: ftFeePercent ?? 0.075,
      mfFeePercent: mfFeePercent ?? 0.01,
      mfFeeCap: mfFeeCap ?? 5999.812,
      vatMultiplier: vatMultiplier ?? 1.25,
      updatedBy: session.user.email ?? session.user.id,
    },
  });

  return NextResponse.json(updated);
}

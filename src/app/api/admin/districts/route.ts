import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { number, name, region } = await req.json();
  if (!number || !name) return NextResponse.json({ error: "Saknade fält" }, { status: 400 });

  try {
    const district = await prisma.district.create({
      data: {
        number: Number(number),
        name,
        region: region ?? "SE",
        feeConfig: {
          create: {
            ftFeePercent: 0.075,
            mfFeePercent: 0.01,
            mfFeeCap: 6000,
            vatMultiplier: 1.25,
          },
        },
      },
      include: {
        users: { select: { id: true, name: true, email: true } },
        feeConfig: true,
        _count: { select: { customers: true, reports: true } },
      },
    });
    return NextResponse.json(district, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Distriktsnummer används redan" }, { status: 409 });
  }
}

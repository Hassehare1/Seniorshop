import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { STANDARD_FEE_CONFIG } from "@/lib/fees";
import { Region } from "@prisma/client";
import { las, z, text, heltal, enumFalt } from "@/lib/validering";

// Ett ogiltigt distriktsnummer blev tidigare NaN, fick Prisma att kasta, och
// fångades av catch-satsen nedan — som svarade "Distriktsnumret används
// redan". Ett missvisande fel på ett problem som inte fanns.
const Schema = z.object({
  number: heltal("Distriktsnumret", 1, 9999),
  name: text("Distriktsnamnet", 100),
  region: enumFalt(Region, "Regionen").default("SE"),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { number, name, region } = data;

  try {
    const district = await prisma.district.create({
      data: {
        number,
        name,
        region,
        feeConfig: {
          create: { ...STANDARD_FEE_CONFIG },
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

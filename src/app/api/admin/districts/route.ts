import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { STANDARD_FEE_CONFIG } from "@/lib/fees";
import { Region } from "@prisma/client";
import { las, z, text, heltal, enumFalt } from "@/lib/validering";
import { medFelhantering } from "@/lib/felhantering";

// Ett ogiltigt distriktsnummer blev tidigare NaN, fick Prisma att kasta, och
// fångades av catch-satsen nedan — som svarade "Distriktsnumret används
// redan". Ett missvisande fel på ett problem som inte fanns.
const Schema = z.object({
  number: heltal("Distriktsnumret", 1, 9999),
  name: text("Distriktsnamnet", 100),
  region: enumFalt(Region, "Regionen").default("SE"),
});

export const POST = medFelhantering(async (req: NextRequest) => {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { number, name, region } = data;

  // Distriktsnumret är unikt. Krocken kollas FÖRE skrivningen så att svaret
  // kan säga vad som faktiskt är fel; en blind catch runt create() låg här
  // tidigare och rapporterade varje fel — även en databas som inte svarade —
  // som "Distriktsnummer används redan". Skulle två anrop ändå hinna krocka
  // fångas P2002 av medFelhantering och blir 409 ändå.
  const upptaget = await prisma.district.findUnique({ where: { number }, select: { id: true } });
  if (upptaget) {
    return NextResponse.json({ error: `Distriktsnummer ${number} används redan.` }, { status: 409 });
  }

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
});

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateFees, type FeeConfig } from "@/lib/fees";

const DEFAULT_FEE_CONFIG: FeeConfig = {
  ftFeePercent: 0.075,
  mfFeePercent: 0.01,
  mfFeeCap: 6000, // ink moms
  vatMultiplier: 1.25,
};

const MAX_VISITS = 500;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: "Session saknar user id" }, { status: 401 });

  const body = await req.json();
  const { districtId, seasonId } = body;
  const week = Number(body.week);
  const visits = body.visits;

  // Grundläggande struktur-validering
  if (!districtId || !seasonId || !Number.isInteger(week) || !Array.isArray(visits)) {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  if (visits.length === 0) {
    return NextResponse.json({ error: "Minst ett besök krävs" }, { status: 400 });
  }
  if (visits.length > MAX_VISITS) {
    return NextResponse.json({ error: "För många besök i en rapport" }, { status: 400 });
  }

  // FT får bara rapportera för sitt eget distrikt
  if (session.user.role !== "ADMIN" && session.user.districtId !== districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Hämta säsong (veckovalidering), avgiftskonfig, distriktets kunder + ev. befintlig rapport
  const [season, feeConfig, districtCustomers, existing] = await Promise.all([
    prisma.season.findUnique({ where: { id: seasonId } }),
    prisma.feeConfig.findUnique({ where: { districtId } }),
    prisma.customer.findMany({ where: { districtId }, select: { id: true } }),
    prisma.weeklyReport.findUnique({
      where: { districtId_seasonId_week: { districtId, seasonId, week } },
      select: { status: true },
    }),
  ]);

  if (!season) {
    return NextResponse.json({ error: "Säsong hittades inte" }, { status: 404 });
  }

  // Veckan måste ligga inom säsongens intervall
  if (week < season.weekStart || week > season.weekEnd) {
    return NextResponse.json(
      { error: `Vecka ${week} ligger utanför säsongen (v${season.weekStart}–${season.weekEnd}).` },
      { status: 400 }
    );
  }

  // Skydda godkända rapporter från att skrivas över
  if (existing?.status === "APPROVED") {
    return NextResponse.json(
      { error: "Rapporten är godkänd av admin och kan inte ändras. Kontakta admin." },
      { status: 403 }
    );
  }

  // Validera varje besök: kund måste tillhöra distriktet + numeriska fält rimliga
  const validCustomerIds = new Set(districtCustomers.map((c) => c.id));
  for (const v of visits) {
    if (!v.customerId || !validCustomerIds.has(v.customerId)) {
      return NextResponse.json(
        { error: "En eller flera kunder tillhör inte ditt distrikt." },
        { status: 400 }
      );
    }
    const num = Number(v.numberOfCustomers);
    const sales = Number(v.sales);
    const fashion = Number(v.fashionShowSales ?? 0);
    if (!Number.isFinite(num) || num < 0 || !Number.isFinite(sales) || sales < 0 || !Number.isFinite(fashion) || fashion < 0) {
      return NextResponse.json({ error: "Ogiltiga värden i ett besök." }, { status: 400 });
    }
  }

  const config = feeConfig ?? DEFAULT_FEE_CONFIG;

  // Allt skrivande sker i EN transaktion. Annars är "ta bort + återskapa besök
  // + räkna om MF-taket för senare veckor" icke-atomärt: ett avbrott mitt i
  // skulle kunna tömma rapporten på besök eller lämna fel MF på efterföljande
  // veckor. MF-läsningarna ligger inne i transaktionen för en konsistent bild.
  const reportId = await prisma.$transaction(async (tx) => {
    // MF ackumulerat från tidigare veckor (samma distrikt + säsong, vecka < denna)
    const priorReports = await tx.weeklyReport.findMany({
      where: { districtId, seasonId, week: { lt: week } },
      include: { visits: { select: { mfFee: true } } },
    });
    const priorMf = priorReports
      .flatMap((r) => r.visits)
      .reduce((s, v) => s + v.mfFee, 0);

    // Räkna om avgifterna server-sidan — klientens värden ignoreras
    let runningMf = priorMf;
    const computedVisits = visits.map((v: Record<string, unknown>) => {
      const sales = Number(v.sales);
      const fashionShowSales = Number(v.fashionShowSales ?? 0);
      const fees = calculateFees(sales + fashionShowSales, runningMf, config);
      runningMf = fees.mfFeeAccumulated;
      return {
        customerId: v.customerId as string,
        numberOfCustomers: Number(v.numberOfCustomers),
        sales,
        isFashionShow: !!v.isFashionShow,
        fashionShowSales,
        isHangerShow: !!v.isHangerShow,
        ftFee: fees.ftFee,
        mfFee: fees.mfFee,
        mfFeeAccumulated: fees.mfFeeAccumulated,
        totalToPay: fees.totalToPay,
        comment: (v.comment as string) || null,
      };
    });

    const report = await tx.weeklyReport.upsert({
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

    await tx.visit.deleteMany({ where: { reportId: report.id } });
    await tx.visit.createMany({
      data: computedVisits.map((v) => ({ ...v, reportId: report.id })),
    });

    // Pkt 7: räkna om MF-taket för efterföljande veckor — de kan ha
    // påverkats om denna vecka matades in i efterhand (i oordning).
    const laterReports = await tx.weeklyReport.findMany({
      where: { districtId, seasonId, week: { gt: week } },
      include: { visits: { orderBy: { createdAt: "asc" } } },
      orderBy: { week: "asc" },
    });
    if (laterReports.length > 0) {
      // MF ackumulerat t.o.m. denna vecka = tidigare veckor + denna veckas omräknade
      let mf = priorMf + computedVisits.reduce((s, v) => s + v.mfFee, 0);

      for (const r of laterReports) {
        for (const v of r.visits) {
          const fees = calculateFees(v.sales + v.fashionShowSales, mf, config);
          mf = fees.mfFeeAccumulated;
          if (
            v.mfFee !== fees.mfFee ||
            v.mfFeeAccumulated !== fees.mfFeeAccumulated ||
            v.totalToPay !== fees.totalToPay
          ) {
            await tx.visit.update({
              where: { id: v.id },
              data: {
                ftFee: fees.ftFee,
                mfFee: fees.mfFee,
                mfFeeAccumulated: fees.mfFeeAccumulated,
                totalToPay: fees.totalToPay,
              },
            });
          }
        }
      }
    }

    return report.id;
  }, { timeout: 15000 });

  return NextResponse.json({ id: reportId });
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

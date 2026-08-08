import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type Decimal from "decimal.js";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateFees, money, sumMoney, type FeeConfig } from "@/lib/fees";

// MF-taket ackumuleras över säsongens veckor, så veckor EFTER den ändrade
// måste räknas om — både när en vecka sparas och när den tas bort.
// startingMf = ackumulerat t.o.m. och med den ändrade veckan.
async function recomputeLaterWeeks(
  tx: Prisma.TransactionClient,
  args: { districtId: string; seasonId: string; week: number; startingMf: Decimal; config: FeeConfig }
) {
  const { districtId, seasonId, week, config } = args;
  const laterReports = await tx.weeklyReport.findMany({
    where: { districtId, seasonId, week: { gt: week } },
    include: { visits: { orderBy: { createdAt: "asc" } } },
    orderBy: { week: "asc" },
  });
  let mf = args.startingMf;
  for (const r of laterReports) {
    for (const v of r.visits) {
      const fees = calculateFees(money(v.sales).plus(v.fashionShowSales), mf, config);
      mf = fees.mfFeeAccumulated;
      // Exakt jämförelse på Decimal — med flyttal gav minsta öresdrift
      // falska missmatchningar och en onödig skrivning per besök.
      if (
        !money(v.mfFee).equals(fees.mfFee) ||
        !money(v.mfFeeAccumulated).equals(fees.mfFeeAccumulated) ||
        !money(v.totalToPay).equals(fees.totalToPay)
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
    // name behövs för att kunna namnge kunden i dubblettfelet
    prisma.customer.findMany({ where: { districtId }, select: { id: true, name: true } }),
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

  const config = feeConfig ?? DEFAULT_FEE_CONFIG;

  // Tom vecka = veckan är inte längre rapporterad: hela rapporten tas bort, så
  // veckan går tillbaka till "ej rapporterad" (markören försvinner och puffen
  // återkommer). Det är så man ångrar ett besök som råkat bli det enda på veckan.
  if (visits.length === 0) {
    await prisma.$transaction(async (tx) => {
      const report = await tx.weeklyReport.findUnique({
        where: { districtId_seasonId_week: { districtId, seasonId, week } },
        select: { id: true },
      });
      if (!report) return; // fanns ingen rapport — inget att ta bort

      await tx.visit.deleteMany({ where: { reportId: report.id } });
      await tx.weeklyReport.delete({ where: { id: report.id } });

      // Veckan bidrar nu med 0 till MF-taket — senare veckor måste räknas om.
      const priorReports = await tx.weeklyReport.findMany({
        where: { districtId, seasonId, week: { lt: week } },
        include: { visits: { select: { mfFee: true } } },
      });
      const priorMf = sumMoney(priorReports.flatMap((r) => r.visits).map((v) => v.mfFee));
      await recomputeLaterWeeks(tx, { districtId, seasonId, week, startingMf: priorMf, config });
    }, { timeout: 15000 });

    return NextResponse.json({ deleted: true });
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

  // En kund får bara rapporteras EN gång per vecka — ett andra besök samma vecka
  // hanteras genom att redigera den befintliga raden. Payloaden innehåller hela
  // veckan (besöken ersätts nedan), så det räcker att kolla den mot sig själv.
  // UI:t spärrar redan valet, men det här är spärren som inte kan kringgås.
  const seen = new Set<string>();
  for (const v of visits) {
    const id = v.customerId as string;
    if (seen.has(id)) {
      const name = districtCustomers.find((c) => c.id === id)?.name ?? "Kunden";
      return NextResponse.json(
        { error: `${name} är rapporterad två gånger samma vecka. Redigera det befintliga besöket i stället för att lägga till ett nytt.` },
        { status: 400 }
      );
    }
    seen.add(id);
  }

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
    const priorMf = sumMoney(priorReports.flatMap((r) => r.visits).map((v) => v.mfFee));

    // Räkna om avgifterna server-sidan — klientens värden ignoreras
    let runningMf = priorMf;
    const computedVisits = visits.map((v: Record<string, unknown>) => {
      // Beloppen är redan validerade ovan; money() bevarar dem exakt hela vägen
      // till lagringen (Decimal), utan flyttalssteg.
      const sales = money(String(v.sales));
      const fashionShowSales = money(String(v.fashionShowSales ?? 0));
      const fees = calculateFees(sales.plus(fashionShowSales), runningMf, config);
      runningMf = fees.mfFeeAccumulated;
      // Antingen-eller: ett besök kan inte vara både modevisning och galge.
      // UI:t spärrar det, men vi håller invarianten även här (modevisning vinner)
      // så att Modevisning + Galge + Övriga alltid summerar till totalen.
      const isFashionShow = !!v.isFashionShow;
      const isHangerShow = !isFashionShow && !!v.isHangerShow;
      return {
        customerId: v.customerId as string,
        numberOfCustomers: Number(v.numberOfCustomers),
        sales,
        isFashionShow,
        fashionShowSales,
        isHangerShow,
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
    // MF ackumulerat t.o.m. denna vecka = tidigare veckor + denna veckas omräknade.
    await recomputeLaterWeeks(tx, {
      districtId, seasonId, week, config,
      startingMf: priorMf.plus(sumMoney(computedVisits.map((v) => v.mfFee))),
    });

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

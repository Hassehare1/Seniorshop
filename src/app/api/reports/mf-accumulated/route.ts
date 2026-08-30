import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { sumMoney } from "@/lib/fees";
import { medFelhantering } from "@/lib/felhantering";

export const GET = medFelhantering(async (req: NextRequest) => {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");
  const week = Number(searchParams.get("week") ?? 99);

  // FT kan bara hämta sitt eget distrikt — admin kan ange valfritt
  const districtId =
    session.user.role === "ADMIN"
      ? searchParams.get("districtId")
      : session.user.districtId ?? null;

  if (!districtId || !seasonId) {
    return NextResponse.json({ accumulated: "0.00" });
  }

  const reports = await prisma.weeklyReport.findMany({
    where: { districtId, seasonId, week: { lt: week } },
    include: { visits: { select: { mfFee: true } } },
  });

  // Skickas som sträng — JSON har ingen exakt decimaltyp och klienten läser in
  // den i Decimal igen (ReportForm räknar avgifter live).
  const accumulated = sumMoney(reports.flatMap((r) => r.visits).map((v) => v.mfFee));

  return NextResponse.json({ accumulated: accumulated.toFixed(2) });
});

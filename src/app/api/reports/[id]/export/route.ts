import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { money, sumMoney, type MoneyInput } from "@/lib/fees";
import { medFelhantering } from "@/lib/felhantering";

export const GET = medFelhantering(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const report = await prisma.weeklyReport.findUnique({
    where: { id },
    include: {
      district: { include: { feeConfig: true } },
      season: true,
      visits: {
        include: { customer: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!report) return NextResponse.json({ error: "Rapport hittades inte" }, { status: 404 });

  if (session.user.role !== "ADMIN" && session.user.districtId !== report.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Exporten visar öre — beloppen kommer som Decimal och formateras exakt.
  const fmt = (n: MoneyInput) =>
    new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      money(n).toNumber()
    );

  // MF-avgiften visas bara för admin — FT:s export får inte kolumnen
  const showMf = session.user.role === "ADMIN";

  const rows = report.visits.map((v) => ({
    Kund: v.customer.name,
    Typ: v.customer.type,
    "Antal kunder": v.numberOfCustomers,
    "Försäljning ink. moms": fmt(v.sales),
    Modevisning: v.isFashionShow ? "Ja" : "Nej",
    "Visning på galge": v.isHangerShow ? "Ja" : "Nej",
    ...(showMf && { "FT-avgift ex moms": fmt(v.ftFee) }),
    ...(showMf && { "MF-avgift ex moms": fmt(v.mfFee) }),
    "Totalt att betala": fmt(v.totalToPay),
    Kommentar: v.comment ?? "",
  }));

  const totals = {
    Kund: "SUMMA",
    Typ: "",
    "Antal kunder": report.visits.reduce((s, v) => s + v.numberOfCustomers, 0),
    "Försäljning ink. moms": fmt(sumMoney(report.visits.map((v) => v.sales))),
    Modevisning: "",
    "Visning på galge": "",
    ...(showMf && { "FT-avgift ex moms": fmt(sumMoney(report.visits.map((v) => v.ftFee))) }),
    ...(showMf && { "MF-avgift ex moms": fmt(sumMoney(report.visits.map((v) => v.mfFee))) }),
    "Totalt att betala": fmt(sumMoney(report.visits.map((v) => v.totalToPay))),
    Kommentar: "",
  };

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([...rows, totals]);

  ws["!cols"] = [
    { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
    { wch: 12 }, { wch: 16 }, { wch: 20 },
    ...(showMf ? [{ wch: 20 }] : []), { wch: 20 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Vecka ${report.week}`);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const seasonLabel = `${report.season.type === "VAR" ? "Var" : "Host"}${report.season.year}`;
  const filename = `D${report.district.number}_vecka${report.week}_${seasonLabel}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

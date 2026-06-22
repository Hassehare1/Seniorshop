import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const report = await prisma.weeklyReport.findUnique({
    where: { id },
    include: {
      district: { include: { feeConfig: true } },
      season: true,
      visits: {
        include: { customer: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!report) return NextResponse.json({ error: "Rapport hittades inte" }, { status: 404 });

  if (session.user.role !== "ADMIN" && session.user.districtId !== report.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const rows = report.visits.map((v) => ({
    Kund: v.customer.name,
    Typ: v.customer.type,
    "Antal kunder": v.numberOfCustomers,
    "Försäljning ink. moms": fmt(v.sales + v.fashionShowSales),
    Modevisning: v.isFashionShow ? "Ja" : "Nej",
    "Modevisning försäljning": v.isFashionShow ? fmt(v.fashionShowSales) : "",
    "Visning på galge": v.isHangerShow ? "Ja" : "Nej",
    "FT-avgift ex moms": fmt(v.ftFee),
    "MF-avgift ex moms": fmt(v.mfFee),
    "Totalt att betala": fmt(v.totalToPay),
    Kommentar: v.comment ?? "",
  }));

  const totals = {
    Kund: "SUMMA",
    Typ: "",
    "Antal kunder": report.visits.reduce((s, v) => s + v.numberOfCustomers, 0),
    "Försäljning ink. moms": fmt(report.visits.reduce((s, v) => s + v.sales + v.fashionShowSales, 0)),
    Modevisning: "",
    "Modevisning försäljning": "",
    "Visning på galge": "",
    "FT-avgift ex moms": fmt(report.visits.reduce((s, v) => s + v.ftFee, 0)),
    "MF-avgift ex moms": fmt(report.visits.reduce((s, v) => s + v.mfFee, 0)),
    "Totalt att betala": fmt(report.visits.reduce((s, v) => s + v.totalToPay, 0)),
    Kommentar: "",
  };

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([...rows, totals]);

  ws["!cols"] = [
    { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
    { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 30 },
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
}

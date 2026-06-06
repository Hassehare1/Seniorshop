import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");
  if (!seasonId) return NextResponse.json({ error: "seasonId krävs" }, { status: 400 });

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return NextResponse.json({ error: "Säsong hittades inte" }, { status: 404 });

  const reports = await prisma.weeklyReport.findMany({
    where: { seasonId, status: { in: ["SUBMITTED", "APPROVED"] } },
    include: {
      district: true,
      visits: { include: { customer: true } },
    },
    orderBy: [{ district: { number: "asc" } }, { week: "asc" }],
  });

  const fmtSEK = (n: number) =>
    new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const typeLabels: Record<string, string> = {
    VARDHEM: "Vårdhem", FORENING: "Förening", TRAFFPUNKT: "Träffpunkt",
    BOENDE_55: "Boende +55", OVRIGT: "Övrigt",
  };

  const rows: unknown[][] = [[
    "Distrikt", "Vecka", "Status", "Kund", "Kundtyp",
    "Antal kunder", "Försäljning", "FT-avgift", "MF-avgift", "Att betala", "Kommentar",
  ]];

  for (const report of reports) {
    for (const visit of report.visits) {
      rows.push([
        `D${report.district.number} – ${report.district.name}`,
        report.week,
        report.status === "APPROVED" ? "Godkänd" : "Inlämnad",
        visit.customer.name,
        typeLabels[visit.customer.type] ?? visit.customer.type,
        visit.numberOfCustomers,
        fmtSEK(visit.sales + visit.fashionShowSales),
        fmtSEK(visit.ftFee),
        fmtSEK(visit.mfFee),
        fmtSEK(visit.totalToPay),
        visit.comment ?? "",
      ]);
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Auto column widths
  const colWidths = rows[0].map((_, ci) =>
    Math.max(...rows.map(r => String(r[ci] ?? "").length)) + 2
  );
  ws["!cols"] = colWidths.map(w => ({ wch: w }));

  XLSX.utils.book_append_sheet(wb, ws, "Rapporter");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const seasonLabel = `${season.type === "VAR" ? "Var" : "Host"}_${season.year}`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="SeniorShop_${seasonLabel}.xlsx"`,
    },
  });
}

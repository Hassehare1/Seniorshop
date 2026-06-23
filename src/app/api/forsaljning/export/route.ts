import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeLabels as typeLabels } from "@/lib/customerTypes";
import * as XLSX from "xlsx";

const statusLabels: Record<string, string> = {
  DRAFT: "Utkast",
  SUBMITTED: "Inlämnad",
  APPROVED: "Godkänd",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && !session.user.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fYear = searchParams.get("year") ?? "";
  const fSeason = searchParams.get("season") ?? "";
  const fDistrict = isAdmin ? (searchParams.get("district") ?? "") : "";
  const fType = searchParams.get("type") ?? "";
  const fStatus = searchParams.get("status") ?? "";
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  // FT scopas hårt till eget distrikt; admin kan välja distrikt (annars alla)
  const where = isAdmin
    ? (fDistrict ? { districtId: fDistrict } : {})
    : { districtId: session.user.districtId! };

  const reports = await prisma.weeklyReport.findMany({
    where,
    include: {
      district: { select: { number: true, name: true } },
      season: { select: { year: true, type: true } },
      visits: { include: { customer: { select: { name: true, type: true } } } },
    },
    orderBy: { week: "asc" },
  });

  type Row = {
    week: number; year: number; seasonType: string;
    districtLabel: string; districtNumber: number;
    customerName: string; customerType: string;
    numberOfCustomers: number; sales: number;
    isFashionShow: boolean; isHangerShow: boolean;
    ftFee: number; mfFee: number; totalToPay: number;
    status: string; comment: string | null;
  };

  let rows: Row[] = reports.flatMap(r =>
    r.visits.map(v => ({
      week: r.week,
      year: r.season.year,
      seasonType: r.season.type,
      districtLabel: `D${r.district.number} – ${r.district.name}`,
      districtNumber: r.district.number,
      customerName: v.customer.name,
      customerType: v.customer.type,
      numberOfCustomers: v.numberOfCustomers,
      sales: v.sales + v.fashionShowSales,
      isFashionShow: v.isFashionShow,
      isHangerShow: v.isHangerShow,
      ftFee: v.ftFee,
      mfFee: v.mfFee,
      totalToPay: v.totalToPay,
      status: r.status,
      comment: v.comment,
    }))
  );

  // Samma filter som vyn
  rows = rows.filter(r =>
    (!fYear || r.year === Number(fYear)) &&
    (!fSeason || r.seasonType === fSeason) &&
    (!fType || r.customerType === fType) &&
    (!fStatus || r.status === fStatus) &&
    (!q ||
      r.customerName.toLowerCase().includes(q) ||
      (typeLabels[r.customerType] ?? "").toLowerCase().includes(q) ||
      (isAdmin && r.districtLabel.toLowerCase().includes(q)))
  );
  rows.sort((a, b) => a.week - b.week || a.customerName.localeCompare(b.customerName, "sv"));

  const fmt = (n: number) =>
    new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  // Beskriv aktiva filter (så det framgår vad som exporterats)
  const districtLabel = fDistrict ? (rows[0]?.districtLabel ?? `Distrikt-id ${fDistrict}`) : "Alla";
  const seasonName = fSeason === "VAR" ? "Vår" : fSeason === "HOST" ? "Höst" : "Alla";
  const filterParts = [
    `År: ${fYear || "Alla"}`,
    `Säsong: ${seasonName}`,
    ...(isAdmin ? [`Distrikt: ${districtLabel}`] : []),
    `Kundtyp: ${fType ? (typeLabels[fType] ?? fType) : "Alla"}`,
    `Status: ${fStatus ? (statusLabels[fStatus] ?? fStatus) : "Alla"}`,
    ...(q ? [`Sök: "${searchParams.get("q")}"`] : []),
  ];

  const header = [
    "Vecka",
    ...(isAdmin ? ["Distrikt"] : []),
    "Kund", "Typ", "Antal kunder", "Försäljning ink. moms",
    "Modevisning", "Visning på galge",
    "FT-avgift ex moms", "MF-avgift ex moms", "Att betala", "Status", "Kommentar",
  ];

  const dataRows = rows.map(r => [
    r.week,
    ...(isAdmin ? [r.districtLabel] : []),
    r.customerName,
    typeLabels[r.customerType] ?? r.customerType,
    r.numberOfCustomers,
    fmt(r.sales),
    r.isFashionShow ? "Ja" : "Nej",
    r.isHangerShow ? "Ja" : "Nej",
    fmt(r.ftFee),
    fmt(r.mfFee),
    fmt(r.totalToPay),
    statusLabels[r.status] ?? r.status,
    r.comment ?? "",
  ]);

  const totals = [
    "Summa",
    ...(isAdmin ? [""] : []),
    `${rows.length} besök`,
    "",
    rows.reduce((s, r) => s + r.numberOfCustomers, 0),
    fmt(rows.reduce((s, r) => s + r.sales, 0)),
    "", "",
    fmt(rows.reduce((s, r) => s + r.ftFee, 0)),
    fmt(rows.reduce((s, r) => s + r.mfFee, 0)),
    fmt(rows.reduce((s, r) => s + r.totalToPay, 0)),
    "", "",
  ];

  const aoa: (string | number)[][] = [
    [isAdmin ? "Försäljning – alla distrikt/urval" : `Försäljning – Distrikt ${session.user.districtNumber}`],
    [`Filter: ${filterParts.join("  ·  ")}`],
    [`Genererad: ${new Date().toLocaleString("sv-SE")}`],
    [],
    header,
    ...dataRows,
    totals,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = header.map((h) => ({ wch: h === "Kund" || h === "Distrikt" || h === "Kommentar" ? 26 : 15 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Försäljning");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const scope = isAdmin ? (fDistrict ? `D${rows[0]?.districtNumber ?? ""}` : "alla-distrikt") : `D${session.user.districtNumber}`;
  const seasonPart = fSeason || fYear ? `_${seasonName}${fYear ? fYear : ""}` : "";
  const filename = `Forsaljning_${scope}${seasonPart}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

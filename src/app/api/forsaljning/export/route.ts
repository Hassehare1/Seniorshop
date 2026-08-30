import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { matchesMaterialFilter, materialFilterOptions, materialSummary, type MaterialFilter } from "@/lib/salesMaterial";
import { prisma } from "@/lib/prisma";
import { customerTypeLabels as typeLabels } from "@/lib/customerTypes";
import * as XLSX from "xlsx";
import { money, sumMoney, type MoneyInput } from "@/lib/fees";
import { medFelhantering } from "@/lib/felhantering";

const statusLabels: Record<string, string> = {
  DRAFT: "Utkast",
  SUBMITTED: "Inlämnad",
  APPROVED: "Godkänd",
};

export const GET = medFelhantering(async (req: NextRequest) => {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

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
  // "sale" | "regular" | tomt (båda) — samma val som i vyn.
  const fSale = searchParams.get("sale") ?? "";
  const fMaterial = (searchParams.get("material") ?? "") as MaterialFilter | "";
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
      visits: { include: { customer: { select: { name: true, type: true, postersA3: true, postersA4: true, digitalMaterial: true, digitalMaterialNote: true } } } },
    },
    orderBy: { week: "asc" },
  });

  type Row = {
    week: number; year: number; seasonType: string;
    districtLabel: string; districtNumber: number;
    customerName: string; customerType: string;
    numberOfCustomers: number; sales: MoneyInput;
    isFashionShow: boolean; isHangerShow: boolean; isSale: boolean;
    postersA3: number; postersA4: number; digitalMaterial: boolean; digitalMaterialNote: string | null;
    ftFee: MoneyInput; mfFee: MoneyInput; totalToPay: MoneyInput;
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
      sales: money(v.sales),
      isFashionShow: v.isFashionShow,
      isHangerShow: v.isHangerShow,
      isSale: v.isSale,
      postersA3: v.customer.postersA3,
      postersA4: v.customer.postersA4,
      digitalMaterial: v.customer.digitalMaterial,
      digitalMaterialNote: v.customer.digitalMaterialNote,
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
    (!fSale || (fSale === "sale" ? r.isSale : !r.isSale)) &&
    (!fMaterial || matchesMaterialFilter(r, fMaterial)) &&
    (!q ||
      r.customerName.toLowerCase().includes(q) ||
      (typeLabels[r.customerType] ?? "").toLowerCase().includes(q) ||
      (isAdmin && r.districtLabel.toLowerCase().includes(q)))
  );
  // Kronologiskt: år, sedan säsong (Vår före Höst), sedan vecka. Utan året
  // blandades samma vecka från olika år om vartannat.
  const seasonRank = (t: string) => (t === "VAR" ? 0 : 1);
  rows.sort(
    (a, b) =>
      a.year - b.year ||
      seasonRank(a.seasonType) - seasonRank(b.seasonType) ||
      a.week - b.week ||
      a.customerName.localeCompare(b.customerName, "sv"),
  );

  // Exporten visar öre — beloppen kommer som Decimal och formateras exakt.
  const fmt = (n: MoneyInput) =>
    new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      money(n).toNumber()
    );

  // Beskriv aktiva filter (så det framgår vad som exporterats)
  const districtLabel = fDistrict ? (rows[0]?.districtLabel ?? `Distrikt-id ${fDistrict}`) : "Alla";
  const seasonName = fSeason === "VAR" ? "Vår" : fSeason === "HOST" ? "Höst" : "Alla";
  const filterParts = [
    `År: ${fYear || "Alla"}`,
    `Säsong: ${seasonName}`,
    ...(isAdmin ? [`Distrikt: ${districtLabel}`] : []),
    `Kundtyp: ${fType ? (typeLabels[fType] ?? fType) : "Alla"}`,
    `Status: ${fStatus ? (statusLabels[fStatus] ?? fStatus) : "Alla"}`,
    `Rea: ${fSale === "sale" ? "Endast rea" : fSale === "regular" ? "Endast ordinarie" : "Rea och ordinarie"}`,
    `Säljmaterial: ${materialFilterOptions.find(o => o.value === (fMaterial || "all"))?.label ?? "Allt säljmaterial"}`,
    ...(q ? [`Sök: "${searchParams.get("q")}"`] : []),
  ];

  const header = [
    "Säsong",
    "Vecka",
    ...(isAdmin ? ["Distrikt"] : []),
    "Kund", "Typ", "Antal kunder", "Försäljning ink. moms",
    "Modevisning", "Visning på galge", "REA", "Säljmaterial",
    ...(isAdmin ? ["FT-avgift ex moms", "MF-avgift ex moms"] : []), "Att betala", "Status", "Kommentar",
  ];

  const dataRows = rows.map(r => [
    `${r.seasonType === "VAR" ? "Vår" : "Höst"} ${r.year}`,
    r.week,
    ...(isAdmin ? [r.districtLabel] : []),
    r.customerName,
    typeLabels[r.customerType] ?? r.customerType,
    r.numberOfCustomers,
    fmt(r.sales),
    r.isFashionShow ? "Ja" : "Nej",
    r.isHangerShow ? "Ja" : "Nej",
    r.isSale ? "Ja" : "Nej",
    materialSummary(r),
    ...(isAdmin ? [fmt(r.ftFee), fmt(r.mfFee)] : []),
    fmt(r.totalToPay),
    statusLabels[r.status] ?? r.status,
    r.comment ?? "",
  ]);

  // Summaraden måste ha exakt lika många celler som header, annars glider
  // siffrorna in under fel rubrik i Excel. Ordningen nedan följer header rad
  // för rad — lägg till en cell här varje gång en kolumn tillkommer där.
  const totals = [
    "Summa",                                            // Säsong
    "",                                                 // Vecka
    ...(isAdmin ? [""] : []),                           // Distrikt
    `${rows.length} besök`,                             // Kund
    "",                                                 // Typ
    rows.reduce((s, r) => s + r.numberOfCustomers, 0),  // Antal kunder
    fmt(sumMoney(rows.map((r) => r.sales))),            // Försäljning
    "", "", "", "",                                     // Modevisning, Galge, REA, Säljmaterial
    ...(isAdmin ? [fmt(sumMoney(rows.map((r) => r.ftFee))), fmt(sumMoney(rows.map((r) => r.mfFee)))] : []),
    fmt(sumMoney(rows.map((r) => r.totalToPay))),       // Att betala
    "", "",                                             // Status, Kommentar
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
});

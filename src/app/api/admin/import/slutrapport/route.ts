import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateFees, money, STANDARD_FEE_CONFIG, type FeeConfig } from "@/lib/fees";
import { CustomerType } from "@prisma/client";
import { findLayout } from "@/lib/importLayout";
import * as XLSX from "xlsx";

const DEFAULT_FEE_CONFIG: FeeConfig = STANDARD_FEE_CONFIG;

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

interface ParsedVisit {
  week: number;
  name: string;
  type: CustomerType;
  sales: number;
  isFashionShow: boolean;
  numberOfCustomers: number;
  comment: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" || !session.user.id) return err("Forbidden", 403);

  const form = await req.formData();
  const file = form.get("file");
  const year = Number(form.get("year"));
  const districtNumber = Number(form.get("districtNumber"));
  const districtName = String(form.get("districtName") ?? "").trim();
  const seasonType = String(form.get("seasonType") ?? "");
  const confirm = form.get("confirm") === "true";

  // --- Validera indata ---
  if (!(file instanceof Blob)) return err("Ingen fil bifogad.");
  if (file.size > 5 * 1024 * 1024) return err("Filen är för stor (max 5 MB)."); // före inläsning i minnet
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return err("Ogiltigt år.");
  if (!Number.isInteger(districtNumber) || districtNumber <= 0) return err("Ogiltigt distriktsnummer.");
  if (seasonType !== "VAR" && seasonType !== "HOST") return err("Välj säsong (Vår eller Höst).");

  // --- Läs Excel ---
  let ws: XLSX.WorkSheet | undefined;
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    ws = wb.Sheets["Rapport"];
  } catch {
    return err("Kunde inte läsa Excel-filen.");
  }
  if (!ws) return err("Fliken \"Rapport\" saknas i filen.");

  // E3 kan innehålla distriktsNUMMER eller FT:ns FÖRETAGSNAMN — filformatet varierar
  // mellan franchisetagare. Används bara till en mjuk varning, aldrig till radmatchning.
  const fileDistrict = ws["E3"] != null ? Number(ws["E3"].v) : null;

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });

  const warnings: string[] = [];
  /** Kunder som finns sedan tidigare men har en annan kundtyp i filen. */
  const typeConflicts: { name: string; existing: string; inFile: string }[] = [];
  const parsed: ParsedVisit[] = [];

  // Kolumnerna hittas på RUBRIK, aldrig på position — se lib/importLayout.ts.
  // Filformatet har redan flyttat sig en gång och tog med sig importen i fallet.
  const layout = findLayout(rows);
  if (!layout) {
    return err(
      'Kunde inte hitta rubrikraden i fliken "Rapport". Den ska innehålla "Vecka", ' +
        '"Namn på besök" och kategorikolumnerna (Äldreboende, Träffpunkter, 55+ …).',
    );
  }

  const cell = (r: unknown[], i: number | null) => (i === null ? undefined : r[i]);

  for (const r of rows) {
    // Datarad känns igen på STRUKTUR: giltig vecka (1–53) + kundnamn.
    // Kolumn A (distrikt/FT-etikett) matchas INTE — en fil = ett distrikt (admin väljer det),
    // och etiketten kan vara nummer eller namn. Rubrik-/summarader saknar namn → filtreras.
    const week = Number(r[layout.week]);
    const nameCell = r[layout.name];
    const name = typeof nameCell === "string" ? nameCell.trim() : "";
    if (!Number.isFinite(week) || week < 1 || week > 53 || !name) continue;

    const ifyllda = layout.typeCols.filter(
      (t) => typeof r[t.col] === "number" && !Number.isNaN(r[t.col] as number),
    );
    if (ifyllda.length === 0) {
      warnings.push(`"${name}" (v.${week}) saknar kundtyp/försäljning — hoppas över.`);
      continue;
    }
    // typeCols är vänster till höger, så en fil som har både den nya och den
    // gamla kolumnuppsättningen läses med den nya.
    if (ifyllda.length > 1) warnings.push(`"${name}" (v.${week}) har flera kundtyp-kolumner ifyllda — använder första.`);

    const antal = Number(cell(r, layout.customers));
    const kommentar = cell(r, layout.comment);

    parsed.push({
      week,
      name,
      type: ifyllda[0].type as CustomerType,
      sales: Number(r[ifyllda[0].col]) || 0,
      isFashionShow: !!cell(r, layout.fashionShow),
      numberOfCustomers: Number.isFinite(antal) ? antal : 0,
      comment: typeof kommentar === "string" && kommentar.trim() ? kommentar : null,
    });
  }

  if (parsed.length === 0) return err("Hittade ingen data (rad 18 och neråt) i filen.");
  if (Number.isFinite(fileDistrict) && fileDistrict !== districtNumber) {
    warnings.push(`Filen anger distrikt ${fileDistrict} men du valde ${districtNumber} — kontrollera att rätt fil är vald.`);
  }
  if (!districtName) {
    const exists = await prisma.district.findUnique({ where: { number: districtNumber } });
    if (!exists) return err("Distriktsnamn krävs för att skapa ett nytt distrikt.");
  }

  const weeks = [...new Set(parsed.map((p) => p.week))].sort((a, b) => a - b);
  const customerNames = [...new Set(parsed.map((p) => p.name))];

  const existingDistrict = await prisma.district.findUnique({
    where: { number: districtNumber },
    include: { feeConfig: true },
  });
  const existingSeason = await prisma.season.findUnique({ where: { type_year: { type: seasonType, year } } });

  // Varna vid kundtyp-krock mot redan registrerade kunder
  if (existingDistrict) {
    const existing = await prisma.customer.findMany({ where: { districtId: existingDistrict.id } });
    const byName = new Map(existing.map((c) => [norm(c.name), c]));
    const seen = new Set<string>();
    for (const p of parsed) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      const ex = byName.get(norm(p.name));
      if (ex && ex.type !== p.type) {
        // Egen lista, inte bland varningarna. Kundtyp styr hur försäljningen
        // grupperas i all analys, så en tyst avvikelse flyttar pengar mellan
        // staplar utan att något ser trasigt ut. Den ska synas för sig.
        typeConflicts.push({ name: p.name, existing: ex.type, inFile: p.type });
      }
    }
  }

  // Räkna faktiskt rapporterade veckor för just detta distrikt × säsong.
  // Säsongen är global (delas av alla distrikt), så att den finns betyder INTE
  // att D{n} har rapporterat — det avgörs bara av befintliga weeklyReport-poster.
  const existingReports =
    existingDistrict && existingSeason
      ? await prisma.weeklyReport.count({
          where: { districtId: existingDistrict.id, seasonId: existingSeason.id },
        })
      : 0;

  const summary = {
    districtNumber,
    districtName: existingDistrict?.name ?? districtName,
    districtExists: !!existingDistrict,
    seasonLabel: `${seasonType === "VAR" ? "Vår" : "Höst"} ${year}`,
    seasonExists: !!existingSeason,
    weekRange: weeks.length ? `${weeks[0]}–${weeks[weeks.length - 1]}` : "",
    customers: customerNames.length,
    visits: parsed.length,
    totalSales: parsed.reduce((s, p) => s + p.sales, 0),
    willOverwrite: existingReports > 0,
    existingReports,
    warnings,
    typeConflicts,
  };

  // --- Granskning (torrkörning) ---
  if (!confirm) return NextResponse.json({ preview: true, summary });

  // --- Bekräftad import: allt i en transaktion ---
  const adminId = session.user.id;
  const result = await prisma.$transaction(
    async (tx) => {
      const district =
        existingDistrict ??
        (await tx.district.create({
          data: { number: districtNumber, name: districtName, region: "SE", feeConfig: { create: DEFAULT_FEE_CONFIG } },
          include: { feeConfig: true },
        }));
      const cfg: FeeConfig = district.feeConfig ?? DEFAULT_FEE_CONFIG;

      const season =
        existingSeason ??
        (await tx.season.create({
          data: { type: seasonType, year, weekStart: weeks[0], weekEnd: weeks[weeks.length - 1] },
        }));

      // Kunder: behåll befintliga (matcha på normaliserat namn), skapa saknade
      const existing = await tx.customer.findMany({ where: { districtId: district.id } });
      const byName = new Map(existing.map((c) => [norm(c.name), c.id]));
      let nextNr = existing.reduce((m, c) => Math.max(m, c.customerNumber), 0) + 1;
      const idByName = new Map<string, string>();
      for (const p of parsed) {
        if (idByName.has(p.name)) continue;
        const exId = byName.get(norm(p.name));
        if (exId) idByName.set(p.name, exId);
        else {
          const c = await tx.customer.create({
            data: { name: p.name, type: p.type, districtId: district.id, approved: true, customerNumber: nextNr++ },
          });
          idByName.set(p.name, c.id);
        }
      }

      // Ersätt periodens rapporter (kunderna rörs ej)
      const old = await tx.weeklyReport.findMany({ where: { districtId: district.id, seasonId: season.id }, select: { id: true } });
      const oldIds = old.map((r) => r.id);
      if (oldIds.length) {
        await tx.visit.deleteMany({ where: { reportId: { in: oldIds } } });
        await tx.weeklyReport.deleteMany({ where: { id: { in: oldIds } } });
      }

      // En WeeklyReport per vecka, MF ackumuleras i veckoordning
      const byWeek = new Map<number, ParsedVisit[]>();
      for (const p of parsed) {
        const arr = byWeek.get(p.week);
        if (arr) arr.push(p);
        else byWeek.set(p.week, [p]);
      }

      let runningMf = money(0);
      let visitCount = 0;
      for (const w of [...byWeek.keys()].sort((a, b) => a - b)) {
        const report = await tx.weeklyReport.create({
          data: { districtId: district.id, seasonId: season.id, week: w, status: "APPROVED", userId: adminId },
        });
        const data = byWeek.get(w)!.map((p) => {
          const fees = calculateFees(p.sales, runningMf, cfg);
          runningMf = fees.mfFeeAccumulated;
          return {
            reportId: report.id,
            customerId: idByName.get(p.name)!,
            numberOfCustomers: p.numberOfCustomers,
            sales: p.sales,
            isFashionShow: p.isFashionShow,
            fashionShowSales: 0,
            isHangerShow: false,
            ftFee: fees.ftFee,
            mfFee: fees.mfFee,
            mfFeeAccumulated: fees.mfFeeAccumulated,
            totalToPay: fees.totalToPay,
            comment: p.comment,
          };
        });
        await tx.visit.createMany({ data });
        visitCount += data.length;
      }

      await tx.auditLog.create({
        data: {
          action: "IMPORT_SLUTRAPPORT",
          entity: "WeeklyReport",
          entityId: season.id,
          userId: adminId,
          userEmail: session.user.email ?? null,
          details: JSON.stringify({
            distrikt: districtNumber,
            säsong: summary.seasonLabel,
            kunder: customerNames.length,
            besök: visitCount,
            ersatteVeckor: oldIds.length,
            distriktSkapat: !existingDistrict,
            säsongSkapad: !existingSeason,
          }),
        },
      });

      return {
        visits: visitCount,
        customers: customerNames.length,
        replacedWeeks: oldIds.length,
        districtCreated: !existingDistrict,
        seasonCreated: !existingSeason,
      };
    },
    { timeout: 30000 }
  );

  return NextResponse.json({ committed: true, result, summary });
}

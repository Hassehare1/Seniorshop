import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { customerTypeLabels } from "@/lib/customerTypes";
import * as XLSX from "xlsx";

const MAX_ROWS = 500;

// Matcha typ mot etikett ("Träffpunkt") eller enum-nyckel ("TRAFFPUNKT"), skiftlägesokänsligt
function parseType(raw: unknown): string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  for (const [key, label] of Object.entries(customerTypeLabels)) {
    if (v === label.toLowerCase() || v === key.toLowerCase()) return key;
  }
  return null;
}

const cell = (row: Record<string, unknown>, key: string) => String(row[key] ?? "").trim();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Import är FT:ns ansvar — kräver eget distrikt
  const districtId = session.user.districtId;
  if (!districtId) {
    return NextResponse.json({ error: "Endast franchisetagare kan importera kunder." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil bifogad." }, { status: 400 });
  }

  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } catch {
    return NextResponse.json({ error: "Kunde inte läsa Excel-filen." }, { status: 400 });
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `För många rader (max ${MAX_ROWS}).` }, { status: 400 });
  }

  const toCreate: Array<Record<string, unknown>> = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // rad 1 = rubrik
    const name = cell(row, "Namn");
    const typeRaw = cell(row, "Typ");

    // Hoppa helt tomma rader tyst
    if (!name && !typeRaw && !cell(row, "Kontaktperson") && !cell(row, "Telefon") && !cell(row, "E-post")) {
      return;
    }
    if (!name) { errors.push({ row: rowNum, message: "Namn saknas" }); return; }

    const type = parseType(typeRaw);
    if (!type) { errors.push({ row: rowNum, message: `Ogiltig typ "${typeRaw}"` }); return; }

    let size: number | null = null;
    const sizeRaw = cell(row, "Storlek");
    if (sizeRaw) {
      const n = Number(sizeRaw);
      if (!Number.isFinite(n) || n < 0) { errors.push({ row: rowNum, message: "Storlek måste vara ett positivt tal" }); return; }
      size = Math.round(n);
    }

    toCreate.push({
      name,
      type,
      districtId,
      contactPerson: cell(row, "Kontaktperson") || null,
      contactRole: cell(row, "Kontaktroll") || null,
      phone: cell(row, "Telefon") || null,
      email: cell(row, "E-post") || null,
      address: cell(row, "Adress") || null,
      notes: cell(row, "Kommentar") || null,
      size,
    });
  });

  const maxNr = await prisma.customer.aggregate({ where: { districtId }, _max: { customerNumber: true } });
  let nextNr = (maxNr._max.customerNumber ?? 0) + 1;
  const created = [];
  for (const data of toCreate) {
    created.push(await prisma.customer.create({ data: { ...data, customerNumber: nextNr++ } as never }));
  }

  if (created.length > 0) {
    await prisma.auditLog.create({
      data: {
        action: "KUNDER_IMPORTERADE",
        entity: "Customer",
        entityId: districtId,
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? null,
        details: JSON.stringify({ antal: created.length }),
      },
    });
  }

  return NextResponse.json({ created, createdCount: created.length, errors });
}

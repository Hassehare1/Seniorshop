import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/fees";

// Slå ihop två dubblettkunder: besöken flyttas till den kund som behålls, den
// andra raderas. Uppstår när samma verkliga kund stavas olika i två importfiler
// ("Tullbom" / "Tullbomsgården") — normalisering fångar inte den sortens
// skillnad, så en människa får avgöra och portalen utföra.
//
// RADERAR, inaktiverar inte: importen matchar nya filer mot ALLA kunder i
// distriktet utan att bry sig om aktiv-flaggan, så ett inaktiverat skal skulle
// fånga upp besök igen vid nästa inläsning och återskapa problemet.
//
// Avgifterna rörs inte. calculateFees tar bara belopp, MF-takets löpande summa
// och distriktets villkor — aldrig kundidentitet. Ett flyttat besök behåller
// vecka, belopp och ordning, så inga summor ändras av en sammanslagning.

const seasonLabel = (s: { type: string; year: number }) =>
  `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}`;

const err = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

const withVisits = {
  district: { select: { number: true } },
  visits: {
    select: {
      id: true,
      reportId: true,
      sales: true,
      report: {
        select: { week: true, season: { select: { type: true, year: true } } },
      },
    },
  },
} as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return err("Forbidden", 403);

  const body = await req.json().catch(() => ({}));
  const keepId = typeof body.keepId === "string" ? body.keepId : "";
  const removeId = typeof body.removeId === "string" ? body.removeId : "";
  const confirm = body.confirm === true;

  if (!keepId || !removeId) return err("Två kunder måste anges.");
  if (keepId === removeId) return err("Det är samma kund.");

  const [keep, remove] = await Promise.all([
    prisma.customer.findUnique({ where: { id: keepId }, include: withVisits }),
    prisma.customer.findUnique({ where: { id: removeId }, include: withVisits }),
  ]);

  if (!keep || !remove) return err("Kunden hittades inte.", 404);
  // Kundnumret är unikt per distrikt och besöken hör till distriktets rapporter
  // — en sammanslagning över distriktsgränsen vore alltid ett misstag.
  if (keep.districtId !== remove.districtId) {
    return err("Kunderna tillhör olika distrikt och kan inte slås ihop.");
  }

  // Krock = båda kunderna har besök i SAMMA veckorapport (distrikt + säsong +
  // vecka). En kund rapporteras en gång per vecka; slås de ihop ändå hamnar två
  // rader på samma kund och vecka, och då kan FT inte spara om veckan.
  const keepByReport = new Map(keep.visits.map((v) => [v.reportId, v]));
  const collisions = remove.visits
    .filter((v) => keepByReport.has(v.reportId))
    .map((v) => {
      const mot = keepByReport.get(v.reportId)!;
      return {
        seasonLabel: seasonLabel(v.report.season),
        week: v.report.week,
        keepSales: toNumber(mot.sales),
        removeSales: toNumber(v.sales),
      };
    })
    .sort((a, b) => a.seasonLabel.localeCompare(b.seasonLabel, "sv") || a.week - b.week);

  const summary = {
    keep: {
      id: keep.id,
      name: keep.name,
      label: `D${keep.district.number}-${keep.customerNumber}`,
      type: keep.type,
      visitCount: keep.visits.length,
    },
    remove: {
      id: remove.id,
      name: remove.name,
      label: `D${remove.district.number}-${remove.customerNumber}`,
      type: remove.type,
      visitCount: remove.visits.length,
    },
    visitsToMove: remove.visits.length,
    typeDiffers: keep.type !== remove.type,
    collisions,
  };

  // --- Granskning (torrkörning) ---
  if (!confirm) return NextResponse.json({ preview: true, summary });

  // Krockar löses för hand först — portalen slår aldrig ihop belopp på egen
  // hand, eftersom det skulle räkna om avgifterna utan att någon bett om det.
  if (collisions.length > 0) {
    return NextResponse.json(
      { error: "Kunderna har besök samma vecka. Lös krockarna först.", summary },
      { status: 409 }
    );
  }

  const visitsMoved = await prisma.$transaction(async (tx) => {
    const moved = await tx.visit.updateMany({
      where: { customerId: removeId },
      data: { customerId: keepId },
    });
    await tx.customer.delete({ where: { id: removeId } });
    await tx.auditLog.create({
      data: {
        action: "KUND_SAMMANSLAGEN",
        entity: "Customer",
        entityId: keepId,
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? null,
        details: JSON.stringify({
          behöll: `${keep.name} (D${keep.district.number}-${keep.customerNumber})`,
          raderade: `${remove.name} (D${remove.district.number}-${remove.customerNumber})`,
          flyttadeBesök: moved.count,
        }),
      },
    });
    return moved.count;
  });

  return NextResponse.json({
    committed: true,
    result: { visitsMoved, keptName: keep.name, removedName: remove.name },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONFIRM_WORD = "TÖMMA";

// Nollställer ENBART siffrorna: alla veckorapporter + besök raderas.
// Kunder, distrikt, säsonger och användare behålls.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN" || !session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== CONFIRM_WORD) {
    return NextResponse.json({ error: `Skriv ${CONFIRM_WORD} för att bekräfta.` }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const visits = await tx.visit.deleteMany({});
    const reports = await tx.weeklyReport.deleteMany({});
    await tx.auditLog.create({
      data: {
        action: "NOLLSTÄLL_SIFFROR",
        entity: "WeeklyReport",
        entityId: "*",
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? null,
        details: JSON.stringify({ raderadeBesök: visits.count, raderadeRapporter: reports.count }),
      },
    });
    return { visits: visits.count, reports: reports.count };
  });

  return NextResponse.json({ ok: true, ...result });
}

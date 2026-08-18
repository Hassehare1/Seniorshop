import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Två nivåer, med skilda bekräftelseord så att den hårdare aldrig kan utlösas
// av vana. "TÖMMA" nollställer bara siffrorna — det är den man kör återkommande.
// "RADERA KUNDER" tar även bort kundregistret OCH säsongsmålen, och är avsedd
// för en enda sak: att gå från testdata till skarp start. Målen följer med
// eftersom ett kvarglömt testmål visas som "0 % av målet" i måluppföljningen —
// en siffra som ser trasig ut utan att vara det, precis när man vill kontrollera
// att den skarpa importen landade rätt.
const ORD = {
  numbers: "TÖMMA",
  all: "RADERA KUNDER",
} as const;

type Scope = keyof typeof ORD;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN" || !session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const scope: Scope = body?.scope === "all" ? "all" : "numbers";
  const ord = ORD[scope];

  if (body?.confirm !== ord) {
    return NextResponse.json({ error: `Skriv ${ord} för att bekräfta.` }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Ordningen är tvingande: besök pekar på både rapport och kund, så de måste
    // bort först. Distrikt, säsonger, avgifter och användare rörs aldrig — de bär
    // användarkopplingar och inställningar som inte hör till datan.
    const visits = await tx.visit.deleteMany({});
    const reports = await tx.weeklyReport.deleteMany({});
    const customers = scope === "all" ? (await tx.customer.deleteMany({})).count : 0;
    const goals = scope === "all" ? (await tx.seasonGoal.deleteMany({})).count : 0;

    await tx.auditLog.create({
      data: {
        action: scope === "all" ? "NOLLSTÄLL_ALLT" : "NOLLSTÄLL_SIFFROR",
        entity: scope === "all" ? "Customer" : "WeeklyReport",
        entityId: "*",
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? null,
        details: JSON.stringify({
          raderadeBesök: visits.count,
          raderadeRapporter: reports.count,
          raderadeKunder: customers,
          raderadeMål: goals,
        }),
      },
    });
    return { visits: visits.count, reports: reports.count, customers, goals };
  });

  return NextResponse.json({ ok: true, scope, ...result });
}

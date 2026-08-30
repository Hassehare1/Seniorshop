import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { las, z, id, belopp, antal } from "@/lib/validering";

// Talkontrollen här var redan god — det som saknades var att id:na och
// målens ÖVRE gränser aldrig kontrollerades.
const Schema = z.object({
  districtId: id("Distrikt-id"),
  seasonId: id("Säsongs-id"),
  salesTarget: belopp("Försäljningsmålet"),
  avgPerVisitTarget: belopp("Snittmålet per besök"),
  visitsTarget: antal("Besöksmålet", 10_000),
  fashionShowsTarget: antal("Modevisningsmålet", 10_000),
});

// Sätt/uppdatera FT:s mål för en säsong (ett per distrikt × säsong).
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const parsed = await las(req, Schema);
  if (parsed instanceof Response) return parsed;
  const { districtId, seasonId, salesTarget, avgPerVisitTarget, visitsTarget, fashionShowsTarget } = parsed;

  // FT får bara sätta mål för sitt eget distrikt; admin för valfritt.
  if (session.user.role !== "ADMIN" && session.user.districtId !== districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.seasonGoal.findUnique({
    where: { districtId_seasonId: { districtId, seasonId } },
  });

  const data = { salesTarget, visitsTarget, avgPerVisitTarget, fashionShowsTarget, updatedBy: session.user.email ?? null };
  const goal = await prisma.seasonGoal.upsert({
    where: { districtId_seasonId: { districtId, seasonId } },
    create: { districtId, seasonId, ...data },
    update: data,
  });

  await prisma.auditLog.create({
    data: {
      action: existing ? "MÅL_ÄNDRADE" : "MÅL_SATTA",
      entity: "SeasonGoal",
      entityId: goal.id,
      userId: session.user.id ?? null,
      userEmail: session.user.email ?? null,
      details: JSON.stringify({ districtId, seasonId, salesTarget, visitsTarget, avgPerVisitTarget, fashionShowsTarget }),
    },
  });

  return NextResponse.json(goal);
}

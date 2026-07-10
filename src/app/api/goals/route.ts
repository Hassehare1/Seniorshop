import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Sätt/uppdatera FT:s mål för en säsong (ett per distrikt × säsong).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { districtId, seasonId } = body;
  if (!districtId || !seasonId) return NextResponse.json({ error: "Saknade fält" }, { status: 400 });

  // FT får bara sätta mål för sitt eget distrikt; admin för valfritt.
  if (session.user.role !== "ADMIN" && session.user.districtId !== districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const salesTarget = Number(body.salesTarget);
  const avgPerVisitTarget = Number(body.avgPerVisitTarget);
  const visitsTarget = Math.round(Number(body.visitsTarget));
  const fashionShowsTarget = Math.round(Number(body.fashionShowsTarget));
  for (const v of [salesTarget, avgPerVisitTarget, visitsTarget, fashionShowsTarget]) {
    if (!Number.isFinite(v) || v < 0) {
      return NextResponse.json({ error: "Målen måste vara positiva tal." }, { status: 400 });
    }
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

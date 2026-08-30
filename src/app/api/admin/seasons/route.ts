import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { SeasonType } from "@prisma/client";
import { las, z, heltal, veckonummer, enumFalt } from "@/lib/validering";
import { medFelhantering } from "@/lib/felhantering";

/**
 * Veckospannet avgör vilka veckor som går att rapportera på — sätts det fel
 * blockeras en hel säsong. Kontrollen `weekStart >= weekEnd` låg tidigare FÖRE
 * Number(), så den jämförde strängar när fälten kom som text, och ett tomt
 * veckofält gav NaN som passerade rakt igenom och kastade först i Prisma.
 */
export const SasongSchema = z
  .object({
    type: enumFalt(SeasonType, "Säsongstyp"),
    year: heltal("År", 2000, 2100),
    weekStart: veckonummer("Startvecka"),
    weekEnd: veckonummer("Slutvecka"),
  })
  .refine((s) => s.weekStart < s.weekEnd, {
    error: "Startveckan måste ligga före slutveckan.",
    path: ["weekStart"],
  });

export const GET = medFelhantering(async () => {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const seasons = await prisma.season.findMany({ orderBy: [{ year: "desc" }, { type: "desc" }] });
  return NextResponse.json(seasons);
});

export const POST = medFelhantering(async (req: NextRequest) => {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const data = await las(req, SasongSchema);
  if (data instanceof Response) return data;
  const { type, year, weekStart, weekEnd } = data;

  const existing = await prisma.season.findUnique({
    where: { type_year: { type, year } },
  });
  if (existing) {
    return NextResponse.json({ error: "Säsongen finns redan", existingId: existing.id }, { status: 409 });
  }

  const season = await prisma.season.create({
    data: { type, year, weekStart, weekEnd },
  });
  return NextResponse.json(season, { status: 201 });
});

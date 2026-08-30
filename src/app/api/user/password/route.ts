import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { las, z, losenord } from "@/lib/validering";
import { medFelhantering } from "@/lib/felhantering";

/**
 * Kontrollen här var `newPassword.length < 6`. Skickades ett TAL blev
 * `.length` undefined, `undefined < 6` falskt, och talet gick vidare till
 * bcrypt.hash som kastade — en ohanterad 500 i stället för ett begripligt fel.
 * Se regressionstestet i lib/validering.test.ts.
 */
const Schema = z.object({
  currentPassword: z.string({ error: "Nuvarande lösenord måste anges." }).min(1, "Nuvarande lösenord måste anges."),
  newPassword: losenord,
});

export const PATCH = medFelhantering(async (req: NextRequest) => {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { currentPassword, newPassword } = data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Användare hittades inte" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Nuvarande lösenord stämmer inte" }, { status: 400 });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  await prisma.auditLog.create({
    data: {
      action: "LÖSENORD_BYTT",
      entity: "User",
      entityId: user.id,
      userId: user.id,
      userEmail: user.email,
    },
  });

  return NextResponse.json({ ok: true });
});

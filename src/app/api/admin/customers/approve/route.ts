import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { las, z, id } from "@/lib/validering";

// Tidigare kontrollerades bara att ids var en ARRAY, aldrig vad den innehöll —
// elementen gick sedan in i Prismas `id: { in: ... }`. Taket på 5000 finns för
// att en lista aldrig ska bli obegränsat stor.
const Schema = z.object({
  ids: z.array(id("Kund-id")).max(5000, "För många kunder i en och samma begäran.").optional(),
});

// Admin godkänner kunder: specifika (ids) eller alla väntande
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const data = await las(req, Schema);
  if (data instanceof Response) return data;
  const { ids } = data;

  const result = await prisma.customer.updateMany({
    where: { approved: false, ...(ids ? { id: { in: ids } } : {}) },
    data: { approved: true },
  });

  if (result.count > 0) {
    await prisma.auditLog.create({
      data: {
        action: "KUND_GODKÄND",
        entity: "Customer",
        entityId: ids && ids.length === 1 ? ids[0] : "bulk",
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? null,
        details: JSON.stringify({ antal: result.count, ...(ids && ids.length === 1 ? {} : { bulk: true }) }),
      },
    });
  }

  return NextResponse.json({ count: result.count });
}

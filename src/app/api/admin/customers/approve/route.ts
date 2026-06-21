import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin godkänner kunder: specifika (ids) eller alla väntande
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;

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

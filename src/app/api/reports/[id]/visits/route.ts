import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/fees";
import { medFelhantering } from "@/lib/felhantering";

// Besöksraderna för EN veckorapport. Översikten hämtar dem först när en rad
// fälls ut, så att admins "alla distrikt"-vy slipper skicka varenda besök i
// hela säsongen till webbläsaren direkt. Se WeeklyReportList.
export const GET = medFelhantering(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const { id } = await params;

  const report = await prisma.weeklyReport.findUnique({
    where: { id },
    select: {
      districtId: true,
      visits: {
        include: { customer: { select: { name: true, type: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!report) return NextResponse.json({ error: "Rapport hittades inte" }, { status: 404 });

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && session.user.districtId !== report.districtId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // FT- och MF-avgift utelämnas för FT, samma regel som exportrouten följer.
  const visits = report.visits.map(v => ({
    id: v.id,
    customerName: v.customer.name,
    customerType: v.customer.type,
    numberOfCustomers: v.numberOfCustomers,
    sales: toNumber(v.sales),
    isFashionShow: v.isFashionShow,
    isHangerShow: v.isHangerShow,
    isSale: v.isSale,
    ...(isAdmin && { ftFee: toNumber(v.ftFee), mfFee: toNumber(v.mfFee) }),
    totalToPay: toNumber(v.totalToPay),
    comment: v.comment,
  }));

  return NextResponse.json({ visits });
});

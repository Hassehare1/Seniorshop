import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, toNumber } from "@/lib/fees";

// Besöksraderna för EN veckorapport. Översikten hämtar dem först när en rad
// fälls ut, så att admins "alla distrikt"-vy slipper skicka varenda besök i
// hela säsongen till webbläsaren direkt. Se WeeklyReportList.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const report = await prisma.weeklyReport.findUnique({
    where: { id },
    select: {
      districtId: true,
      visits: {
        include: { customer: { select: { name: true, type: true } } },
        orderBy: { createdAt: "asc" },
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
    sales: toNumber(money(v.sales).plus(v.fashionShowSales)),
    isFashionShow: v.isFashionShow,
    isHangerShow: v.isHangerShow,
    ...(isAdmin && { ftFee: toNumber(v.ftFee), mfFee: toNumber(v.mfFee) }),
    totalToPay: toNumber(v.totalToPay),
    comment: v.comment,
  }));

  return NextResponse.json({ visits });
}

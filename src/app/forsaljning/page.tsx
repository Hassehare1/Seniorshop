import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCurrentWeekAndYear } from "@/lib/week";
import ForsaljningClient, { type SalesRow } from "./ForsaljningClient";

export default async function ForsaljningPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && !session.user.districtId) redirect("/dashboard");

  // FT: bara eget distrikt. Admin: alla distrikt.
  const where = isAdmin ? {} : { districtId: session.user.districtId! };

  const [reports, seasons] = await Promise.all([
    prisma.weeklyReport.findMany({
      where,
      include: {
        district: { select: { number: true, name: true } },
        season: { select: { year: true, type: true } },
        visits: { include: { customer: { select: { name: true, type: true } } } },
      },
      orderBy: { week: "asc" },
    }),
    prisma.season.findMany(),
  ]);

  const rows: SalesRow[] = reports.flatMap(r =>
    r.visits.map(v => ({
      id: v.id,
      week: r.week,
      year: r.season.year,
      seasonType: r.season.type,
      seasonLabel: `${r.season.type === "VAR" ? "Vår" : "Höst"} ${r.season.year}`,
      districtId: r.districtId,
      districtLabel: `D${r.district.number} – ${r.district.name}`,
      districtNumber: r.district.number,
      customerName: v.customer.name,
      customerType: v.customer.type,
      numberOfCustomers: v.numberOfCustomers,
      sales: v.sales + v.fashionShowSales,
      isFashionShow: v.isFashionShow,
      isHangerShow: v.isHangerShow,
      ftFee: v.ftFee,
      mfFee: v.mfFee,
      totalToPay: v.totalToPay,
      status: r.status,
      comment: v.comment,
    }))
  );

  // Default-filter = innevarande säsong (den vars veckointervall + år matchar idag)
  const { week, year } = getCurrentWeekAndYear();
  const current = seasons.find(s => s.year === year && s.weekStart <= week && s.weekEnd >= week);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Försäljning</h1>
        <p className="text-slate-500 text-sm mt-1">
          {isAdmin
            ? "Alla distrikt — komplett lista, filtrerbar och exporterbar"
            : `Distrikt ${session.user.districtNumber} — komplett lista, filtrerbar och exporterbar`}
        </p>
      </div>
      <ForsaljningClient
        rows={rows}
        isAdmin={isAdmin}
        defaultYear={current?.year ?? null}
        defaultSeasonType={current?.type ?? null}
      />
    </div>
  );
}

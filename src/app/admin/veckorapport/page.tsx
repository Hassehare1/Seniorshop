import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatSEK, toNumber } from "@/lib/fees";
import { getISOWeek } from "@/lib/week";
import { veckorapportRader, veckorapportSumma } from "@/lib/insights/veckorapport";
import PeriodValjare from "./PeriodValjare";

// Underlaget till Senior Shops veckorapport. ADMIN ONLY — FT ser inte den här
// sidan och har ingen länk till den. Här är mindre försäljning borta ur alla
// tal, till skillnad från översikten där omsättning och besök är totaler.
// Uträkningen ligger i lib/insights/veckorapport.ts och är testad där.

export default async function VeckorapportPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const { season: seasonParam, week: weekParam } = await searchParams;

  const allSeasons = await prisma.season.findMany({ orderBy: [{ year: "desc" }, { type: "desc" }] });
  if (!allSeasons.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Veckorapport</h1>
        <p className="text-slate-500">Ingen säsong hittades.</p>
      </div>
    );
  }

  const season = (seasonParam && allSeasons.find(s => s.id === seasonParam)) || allSeasons[0];
  const seasonLabel = `${season.type === "VAR" ? "Vår" : "Höst"} ${season.year}`;
  const weeks = Array.from(
    { length: season.weekEnd - season.weekStart + 1 },
    (_, i) => i + season.weekStart,
  );

  // Utan veckoval: innevarande vecka om den ligger i säsongen, annars hela
  // säsongen. Att tyst falla tillbaka på säsongens första vecka hade sett ut
  // som en vecka utan försäljning i stället för som ett uteblivet val.
  const nuvarandeVecka = getISOWeek();
  const week =
    weekParam ??
    (weeks.includes(nuvarandeVecka) ? String(nuvarandeVecka) : "alla");
  const valdVecka = week === "alla" ? null : Number(week);

  const [districts, reports] = await Promise.all([
    prisma.district.findMany({
      select: { id: true, number: true, name: true },
      orderBy: { number: "asc" },
    }),
    prisma.weeklyReport.findMany({
      where: {
        seasonId: season.id,
        ...(valdVecka != null ? { week: valdVecka } : {}),
      },
      select: {
        districtId: true,
        visits: {
          select: {
            sales: true,
            numberOfCustomers: true,
            customer: { select: { type: true } },
          },
        },
      },
    }),
  ]);

  // Decimal går inte att skicka till klienten och inte att räkna på med +.
  // Konverteras här, ett besök i taget, precis som i översikten.
  const rader = veckorapportRader(
    reports.map(r => ({
      districtId: r.districtId,
      visits: r.visits.map(v => ({
        customerType: v.customer.type,
        sales: toNumber(v.sales),
        numberOfCustomers: v.numberOfCustomers,
      })),
    })),
    districts,
  );
  const summa = veckorapportSumma(rader);

  const periodLabel = valdVecka != null ? `vecka ${valdVecka}` : "hela säsongen";
  const antal = (n: number) => n.toLocaleString("sv-SE");
  const kr = (n: number) => formatSEK(Math.round(n));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold text-slate-800">Veckorapport</h1>
        <PeriodValjare
          seasons={allSeasons.map(s => ({
            id: s.id,
            label: `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}`,
          }))}
          seasonId={season.id}
          weeks={weeks}
          week={week}
        />
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Underlag till Senior Shops sammanställning, {seasonLabel} · {periodLabel}. Mindre
        försäljning ingår inte i något av talen — omsättningen delad med antalet besök är
        alltså snittet rakt av.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Distrikt</th>
                <th className="text-right px-4 py-3 font-semibold">Försäljning</th>
                <th className="text-right px-4 py-3 font-semibold">Antal besök</th>
                <th className="text-right px-4 py-3 font-semibold">Antal kunder</th>
                <th className="text-right px-4 py-3 font-semibold">Omsättn. pr besök</th>
                <th className="text-right px-4 py-3 font-normal normal-case tracking-normal text-slate-400">
                  Borttaget
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rader.map(r => (
                <tr key={r.districtId} className={r.besok === 0 ? "text-slate-400" : ""}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{r.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.sales > 0 ? kr(r.sales) : "–"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.besok > 0 ? antal(r.besok) : "–"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.kunder > 0 ? antal(r.kunder) : "–"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {r.besok > 0 ? kr(r.snitt) : "–"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-400 whitespace-nowrap">
                    {r.bortSales > 0 || r.bortKunder > 0
                      ? `${kr(r.bortSales)} · ${antal(r.bortKunder)} kunder`
                      : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-800">
                <td className="px-4 py-3">Summa</td>
                <td className="px-4 py-3 text-right tabular-nums">{kr(summa.sales)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{antal(summa.besok)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{antal(summa.kunder)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{summa.besok > 0 ? kr(summa.snitt) : "–"}</td>
                <td className="px-4 py-3 text-right text-xs font-normal tabular-nums text-slate-400 whitespace-nowrap">
                  {summa.bortSales > 0 || summa.bortKunder > 0
                    ? `${kr(summa.bortSales)} · ${antal(summa.bortKunder)} kunder`
                    : "–"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400 max-w-2xl">
        Portalens totala omsättning för samma period är {kr(summa.totalSales)} på{" "}
        {antal(summa.totalBesok)} besök — det är den som rapporteras och faktureras.
        Tabellen ovan räknar bort mindre försäljning, eftersom lagerförsäljning och
        småpartier inte är besök i den mening snittkvittot mäter.
      </p>
    </div>
  );
}

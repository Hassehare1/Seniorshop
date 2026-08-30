import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/fees";
import { isoWeekMonday } from "@/lib/week";
import type { Season } from "@prisma/client";

export type SeasonStatus = "past" | "current" | "future";

export interface ForecastSeason {
  label: string;          // "Vår 2026"
  status: SeasonStatus;
  note: string;           // förklarar underlaget, t.ex. "pågår · 55 av 71 kunder besökta"
  actual: number;         // utfall (faktiska besök i år)
  forecast: number;       // prognosdel (fjolår på ej besökta kunder)
  total: number;          // actual + forecast
  hasBasis: boolean;      // false = säsongen saknar både utfall och fjolårsunderlag
}

export interface ForecastData {
  year: number;
  total: number;          // helårsprognos
  actualTotal: number;    // summa utfall hittills
  forecastTotal: number;  // summa prognosdel
  prevYearTotal: number;  // fjolårets faktiska helår (0 om saknas)
  seasons: ForecastSeason[];
}

// isoWeekMonday låg tidigare privat här, otestad — trots att den avgör vilken
// del av helårsprognosen som är utfall och vilken som är gissning. Flyttad till
// lib/week.ts 2026-08-30, där all ISO-veckoräkning bor och har tester.

/**
 * Helårsprognos (FY): per säsong, kund-mot-kund mot fjolår. Ett helår = Vår +
 * Höst. En kund som redan besökts i en säsong räknas på faktiskt utfall; en
 * som ännu inte besökts prognostiseras på samma kunds utfall i motsvarande
 * säsong fjolåret. Avslutad säsong prognostiserar inte (utfallet är facit).
 * Oberoende av om Översikten just nu visar Vår, Höst eller Helår — kortet
 * rör alltid hela kalenderåret `fyYear`.
 *
 * Utbruten ur dashboard/page.tsx 2026-08-27 — den mest självständiga och
 * datumtunga klumpen där, redan tidigare noterad som "eget steg om det
 * behövs" (se [[dashboard-lazy-visits]]).
 */
export async function loadForecast(
  fyYear: number,
  allSeasons: Season[],
  selectedDistrictId: string | null,
): Promise<ForecastData | null> {
  const slots = [
    { type: "VAR" as const, label: "Vår" },
    { type: "HOST" as const, label: "Höst" },
  ];
  const thisYearRec = slots.map(sl => allSeasons.find(s => s.type === sl.type && s.year === fyYear));
  const lastYearRec = slots.map(sl => allSeasons.find(s => s.type === sl.type && s.year === fyYear - 1));
  const relevantIds = [...thisYearRec, ...lastYearRec]
    .filter((s): s is (typeof allSeasons)[number] => !!s)
    .map(s => s.id);

  if (relevantIds.length === 0) return null;

  const fyReports = await prisma.weeklyReport.findMany({
    where: { seasonId: { in: relevantIds }, ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}) },
    include: { visits: { select: { sales: true, customerId: true, customer: { select: { active: true } } } } },
  });
  // Aktiva kunder i urvalet — nämnare för "X av Y besökta". Approval-state
  // används inte: en oapprovad kund ska inte kunna dölja täckningsgraden.
  const totalCustomers = await prisma.customer.count({
    where: { active: true, ...(selectedDistrictId ? { districtId: selectedDistrictId } : {}) },
  });

  const seasonById = new Map(allSeasons.map(s => [s.id, s]));
  // Per slot (0 = Vår, 1 = Höst): utfall i år resp. fjolår per kund.
  const thisYear: Map<string, number>[] = [new Map(), new Map()];
  const lastYear: Map<string, { sales: number; active: boolean }>[] = [new Map(), new Map()];
  for (const r of fyReports) {
    const meta = seasonById.get(r.seasonId);
    if (!meta) continue;
    const slot = meta.type === "VAR" ? 0 : 1;
    for (const v of r.visits) {
      const sale = toNumber(v.sales);
      if (meta.year === fyYear) {
        thisYear[slot].set(v.customerId, (thisYear[slot].get(v.customerId) ?? 0) + sale);
      } else {
        const prev = lastYear[slot].get(v.customerId);
        lastYear[slot].set(v.customerId, { sales: (prev?.sales ?? 0) + sale, active: v.customer.active });
      }
    }
  }

  const now = new Date();
  const seasons: ForecastSeason[] = slots.map((sl, i) => {
    const rec = thisYearRec[i];
    let status: SeasonStatus;
    if (rec) {
      const start = isoWeekMonday(fyYear, rec.weekStart);
      const end = isoWeekMonday(fyYear, rec.weekEnd);
      end.setUTCDate(end.getUTCDate() + 6); // söndagen i sista veckan
      status = now < start ? "future" : now > end ? "past" : "current";
    } else {
      status = "future"; // säsongen ej upplagd → har inte börjat
    }

    const actual = [...thisYear[i].values()].reduce((a, b) => a + b, 0);
    // Prognosdel: fjolår för ej besökta, fortfarande aktiva kunder.
    let forecast = 0;
    if (status !== "past") {
      for (const [custId, ly] of lastYear[i]) {
        if (ly.active && !thisYear[i].has(custId)) forecast += ly.sales;
      }
    }

    const hasBasis = actual > 0 || forecast > 0;
    const prevLabel = `${sl.label} ${fyYear - 1}`;
    let note: string;
    if (status === "past") {
      note = "avslutad · utfall";
    } else if (status === "current") {
      note = totalCustomers > 0 ? `pågår · ${thisYear[i].size} av ${totalCustomers} kunder besökta` : "pågår";
    } else {
      note = hasBasis ? `ej börjat · prognos på ${prevLabel}` : "ej börjat · underlag saknas";
    }

    return { label: `${sl.label} ${fyYear}`, status, note, actual, forecast, total: actual + forecast, hasBasis };
  });

  const actualTotal = seasons.reduce((a, s) => a + s.actual, 0);
  const forecastTotal = seasons.reduce((a, s) => a + s.forecast, 0);
  const total = actualTotal + forecastTotal;
  // Fjolårets faktiska helår (alla kunder, båda säsonger) för tillväxt-%.
  const prevYearTotal = lastYear.reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y.sales, 0), 0);

  // Visa bara med underlag: fjolårsdata att prognostisera mot, eller ett helt
  // avslutat år (då prognosen = utfallet).
  const allPast = seasons.every(s => s.status === "past");
  if (total > 0 && (prevYearTotal > 0 || allPast)) {
    return { year: fyYear, total, actualTotal, forecastTotal, prevYearTotal, seasons };
  }
  return null;
}

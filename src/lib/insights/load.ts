import { prisma } from "@/lib/prisma";
import { money, toNumber, type MoneyInput } from "@/lib/fees";
import type { ReportInput } from "./aggregate";

/**
 * Vilket urval en fråga gäller: en säsong, och valfritt ett distrikt.
 * Utan distrikt omfattas alla — det är admins vy över hela landet.
 */
export type SeasonScope = {
  seasonId: string;
  /** Utelämnas eller null = alla distrikt. */
  districtId?: string | null;
};

/**
 * Veckorapporterna med sina besök för ett urval.
 *
 * Låg tidigare inbakad i dashboard/page.tsx, vilket gjorde att ingen annan del
 * av portalen kunde ställa samma fråga. Här kan den återanvändas av en
 * frågesida, en export eller vad som kommer härnäst.
 *
 * OBS: gör ingen behörighetskontroll. Anroparen ansvarar för att districtId
 * kommer från sessionen när användaren inte är admin.
 */
export function loadSeasonReports(scope: SeasonScope) {
  return prisma.weeklyReport.findMany({
    where: {
      seasonId: scope.seasonId,
      ...(scope.districtId ? { districtId: scope.districtId } : {}),
    },
    include: {
      district: { select: { number: true, name: true } },
      visits: { include: { customer: { select: { name: true, type: true } } } },
    },
    orderBy: { week: "asc" },
  });
}

export type LoadedReport = Awaited<ReturnType<typeof loadSeasonReports>>[number];

/** Minsta form `toAggregateInput` behöver — Prisma-raderna uppfyller den. */
type RawVisit = {
  customer: { type: string };
  sales: MoneyInput;
  fashionShowSales: MoneyInput;
  ftFee: MoneyInput;
  mfFee: MoneyInput;
  numberOfCustomers: number;
  isFashionShow: boolean;
  isHangerShow: boolean;
};
type RawReport = {
  week: number;
  districtId: string;
  district: { number: number; name: string };
  visits: RawVisit[];
};

/**
 * Databasrader → aggregeringens indata.
 *
 * Beloppen görs om från Decimal till tal här, ett besök i taget. Modevisnings-
 * försäljningen läggs till den vanliga; fältet är i praktiken alltid noll men
 * summeras för säkerhets skull, precis som förut.
 */
export function toAggregateInput(reports: RawReport[]): ReportInput[] {
  return reports.map(r => ({
    week: r.week,
    districtId: r.districtId,
    districtNumber: r.district.number,
    districtName: r.district.name,
    visits: r.visits.map(v => ({
      customerType: v.customer.type,
      sales: toNumber(money(v.sales).plus(v.fashionShowSales)),
      ftFee: toNumber(v.ftFee),
      mfFee: toNumber(v.mfFee),
      numberOfCustomers: v.numberOfCustomers,
      isFashionShow: v.isFashionShow,
      isHangerShow: v.isHangerShow,
    })),
  }));
}

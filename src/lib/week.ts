// ISO-veckoräkning. All sådan logik bor HÄR — den har haft en envis vana att
// kopieras. Först fanns tre kopior, varav en patchade Date.prototype; de
// städades 2026-08-26. Två blev kvar och samlas in nu: isoWeekMonday som låg
// privat i insights/forecast.ts, och en handskriven variant i
// admin/sasonger/SasongerClient.tsx.

/**
 * Vilken ISO-vecka (och vilket ISO-år) ett datum tillhör.
 *
 * Första raden är inte en formalitet: datumet projiceras till UTC-midnatt för
 * den LOKALA kalenderdagen. Utan det läser getUTCDay() fel dag för alla
 * tidszoner öster om Greenwich under kvällen — i svensk tid blir 00:30 den
 * 1 januari till 23:30 den 31 december, och veckonumret hoppar ett steg.
 * Kopian i SasongerClient saknade just den raden.
 */
function isoWeekInfo(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

export function getISOWeek(date: Date = new Date()): number {
  return isoWeekInfo(date).week;
}

export function getCurrentWeekAndYear(date: Date = new Date()): { week: number; year: number } {
  return isoWeekInfo(date);
}

/**
 * Måndagen i en given ISO-vecka, som UTC-datum. Motsatsen till isoWeekInfo.
 *
 * ISO-vecka 1 är per definition veckan som innehåller 4 januari, så
 * uträkningen utgår därifrån: hitta måndagen i den veckan, stega sedan
 * (vecka − 1) veckor framåt.
 *
 * Låg tidigare privat i insights/forecast.ts, där den avgör om en säsong är
 * avslutad, pågående eller kommande — alltså vilken del av helårsprognosen
 * som är utfall och vilken som är gissning. Den logiken var otestad.
 */
export function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // 0 = måndag
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Dow + (week - 1) * 7);
  return monday;
}

// ISO-veckonummer (UTC-baserat). Delad logik — fanns tidigare kopierad
// på tre ställen, varav en patchade inbyggda Date.prototype.

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

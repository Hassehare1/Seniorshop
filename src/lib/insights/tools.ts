import { prisma } from "@/lib/prisma";
import { formatSEK } from "@/lib/fees";
import { customerTypeLabels } from "@/lib/customerTypes";
import { salesPace } from "@/lib/goals";
import { aggregateByType, goalActualsFrom, uniqueWeeks } from "./aggregate";
import { loadSeasonReports, toAggregateInput } from "./load";

/**
 * Vem som frågar. Härleds ur sessionen i routen — ALDRIG ur modellens svar.
 *
 * Modellen får aldrig vara det som avgör vem som ser vad. Den föreslår vilken
 * fråga som ska ställas; servern bestämmer på vilket underlag.
 */
export type ToolScope = {
  isAdmin: boolean;
  /** FT:s eget distrikt. Null för admin. */
  ownDistrictId: string | null;
};

/**
 * Vilket distrikt frågan gäller.
 *
 * FT får alltid sitt eget, oavsett vad modellen skickar med. Admin får det
 * distrikt hon ber om, eller alla. Öppnas assistenten för FT senare är det
 * den här funktionen som redan gör rätt.
 */
async function resolveDistrict(
  scope: ToolScope,
  districtNumber?: number,
): Promise<{ districtId: string | null; label: string }> {
  if (!scope.isAdmin) {
    return { districtId: scope.ownDistrictId, label: "ditt distrikt" };
  }
  if (districtNumber == null) {
    return { districtId: null, label: "alla distrikt" };
  }
  const d = await prisma.district.findFirst({ where: { number: districtNumber } });
  if (!d) return { districtId: null, label: `distrikt ${districtNumber} finns inte — visar alla` };
  return { districtId: d.id, label: `D${d.number} – ${d.name}` };
}

const distriktParam = {
  distriktsnummer: {
    type: "number",
    description:
      "Distriktets nummer, t.ex. 6 för D6. Utelämnas för alla distrikt. Ignoreras för franchisetagare, som alltid får sitt eget distrikt.",
  },
} as const;

/** Katalogen modellen får välja ur. Håll den kort — färre verktyg väljs rätt oftare. */
export const assistantTools = [
  {
    name: "lista_sasonger",
    description:
      "Lista alla säsonger i portalen med id, namn och veckointervall. Anropa den här först när frågan gäller en säsong, för att få rätt seasonId.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "forsaljning_per_kundtyp",
    description:
      "Försäljning, antal besök, antal besökare och modevisningar per kundtyp för en säsong. Använd när frågan gäller hur försäljningen fördelar sig, vilken kundtyp som säljer bäst, eller totalen för en säsong.",
    inputSchema: {
      type: "object",
      properties: {
        seasonId: { type: "string", description: "Säsongens id från lista_sasonger." },
        ...distriktParam,
      },
      required: ["seasonId"],
    },
  },
  {
    name: "mal_mot_utfall",
    description:
      "Målen för en säsong jämfört med utfallet: försäljning, antal besök, snitt per besök och modevisningar. Innehåller också vad som krävs per återstående besök för att nå säljmålet. Använd när frågan gäller mål, hur det går, eller vad som återstår.",
    inputSchema: {
      type: "object",
      properties: {
        seasonId: { type: "string", description: "Säsongens id från lista_sasonger." },
        ...distriktParam,
      },
      required: ["seasonId"],
    },
  },
] as const;

export type AssistantToolName = (typeof assistantTools)[number]["name"];

/**
 * Kör ett verktyg. Returnerar vanlig JSON — modellen ser bara resultatet och
 * räknar aldrig själv.
 */
export async function runAssistantTool(
  name: string,
  input: Record<string, unknown>,
  scope: ToolScope,
): Promise<unknown> {
  switch (name) {
    case "lista_sasonger": {
      const seasons = await prisma.season.findMany({
        orderBy: [{ year: "desc" }, { type: "desc" }],
      });
      return {
        sasonger: seasons.map(s => ({
          seasonId: s.id,
          namn: `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}`,
          ar: s.year,
          veckor: `${s.weekStart}–${s.weekEnd}`,
        })),
      };
    }

    case "forsaljning_per_kundtyp": {
      const { districtId, label } = await resolveDistrict(scope, input.distriktsnummer as number | undefined);
      const reports = await loadSeasonReports({ seasonId: String(input.seasonId), districtId });
      const agg = toAggregateInput(reports);
      const { byType } = aggregateByType(agg, uniqueWeeks(agg));
      const totals = goalActualsFrom(byType);

      return {
        urval: label,
        totalt: {
          forsaljning: formatSEK(Math.round(totals.sales)),
          besok: totals.visits,
          snittPerBesok: formatSEK(Math.round(totals.avgPerVisit)),
          modevisningar: totals.fashionShows,
        },
        perKundtyp: byType.map(t => ({
          kundtyp: customerTypeLabels[t.type] ?? t.type,
          forsaljning: formatSEK(Math.round(t.sales)),
          andelAvTotalen:
            totals.sales > 0 ? `${Math.round((t.sales / totals.sales) * 100)} %` : "0 %",
          besok: t.besok,
          besokare: t.customers,
          modevisningar: t.fashionShows,
        })),
      };
    }

    case "mal_mot_utfall": {
      const { districtId, label } = await resolveDistrict(scope, input.distriktsnummer as number | undefined);
      if (!districtId) {
        return {
          fel: "Mål sätts per distrikt. Ange ett distriktsnummer för att jämföra mål mot utfall.",
        };
      }

      const seasonId = String(input.seasonId);
      const goal = await prisma.seasonGoal.findUnique({
        where: { districtId_seasonId: { districtId, seasonId } },
      });
      if (!goal) return { urval: label, fel: "Inga mål satta för den säsongen." };

      const reports = await loadSeasonReports({ seasonId, districtId });
      const agg = toAggregateInput(reports);
      const { byType } = aggregateByType(agg, uniqueWeeks(agg));
      const actuals = goalActualsFrom(byType);
      const pace = salesPace(goal, actuals);

      const jamfor = (utfall: number, mal: number, pengar: boolean) => ({
        utfall: pengar ? formatSEK(Math.round(utfall)) : Math.round(utfall),
        mal: pengar ? formatSEK(Math.round(mal)) : Math.round(mal),
        andelAvMal: mal > 0 ? `${Math.round((utfall / mal) * 100)} %` : "inget mål satt",
      });

      return {
        urval: label,
        forsaljning: jamfor(actuals.sales, goal.salesTarget, true),
        besok: jamfor(actuals.visits, goal.visitsTarget, false),
        snittPerBesok: jamfor(actuals.avgPerVisit, goal.avgPerVisitTarget, true),
        modevisningar: jamfor(actuals.fashionShows, goal.fashionShowsTarget, false),
        saljtakt:
          pace.kind === "reached"
            ? "Säljmålet är redan nått."
            : pace.kind === "perVisit"
              ? `Krävs ${formatSEK(Math.round(pace.perVisit))} per besök på de ${pace.visitsLeft} som återstår.`
              : pace.kind === "visitsExhausted"
                ? `Besöksmålet är nått, ${formatSEK(Math.round(pace.salesLeft))} kvar till säljmålet.`
                : "Går inte att räkna — mål saknas.",
      };
    }

    default:
      return { fel: `Okänt verktyg: ${name}` };
  }
}

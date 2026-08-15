import { prisma } from "@/lib/prisma";
import { formatSEK } from "@/lib/fees";
import { customerTypeLabels } from "@/lib/customerTypes";
import { salesPace } from "@/lib/goals";
import { resolveReportSeason } from "@/lib/season";
import { getCurrentWeekAndYear } from "@/lib/week";
import { aggregateByDistrict, aggregateByType, goalActualsFrom, uniqueWeeks } from "./aggregate";
import { comparableWeeks, rankDistricts } from "./compare";
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

const seasonLabel = (s: { type: string; year: number }) =>
  `${s.type === "VAR" ? "Vår" : "Höst"} ${s.year}`;

/** Säsongerna, nyast först. Sorteras i JS så ordningen inte hänger på enum-ordningen. */
async function seasonsNewestFirst() {
  const seasons = await prisma.season.findMany();
  return seasons.sort((a, b) => b.year - a.year || b.weekStart - a.weekStart);
}

/**
 * Vilken säsong "nu" är, enligt samma regel som rapporteringssidan.
 *
 * Utan den här gissar modellen — den vet inte vilket datum det är, och valde
 * en säsong flera år tillbaka när frågan inte nämnde någon. Ligger dagens
 * vecka i glappet mellan två säsonger faller vi tillbaka på den senaste, för
 * här läser vi bara och en ungefärlig säsong slår ett obesvarat svar.
 */
export async function currentSeason() {
  const { week, year } = getCurrentWeekAndYear();
  const seasons = await seasonsNewestFirst();
  const träff = resolveReportSeason(seasons, week, year);
  const vald = träff ?? seasons[0];
  if (!vald) return null;
  return {
    seasonId: vald.id,
    namn: seasonLabel(vald),
    pagaende: träff != null,
    idag: `vecka ${week} ${year}`,
  };
}

/** Säsongen frågan gäller: den modellen bad om, annars den aktuella. */
async function resolveSeasonId(input: Record<string, unknown>): Promise<string | null> {
  if (typeof input.seasonId === "string" && input.seasonId !== "") return input.seasonId;
  return (await currentSeason())?.seasonId ?? null;
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
        seasonId: {
          type: "string",
          description:
            "Säsongens id från lista_sasonger. Utelämnas för den säsong som pågår nu — gör det när frågan inte nämner någon säsong.",
        },
        ...distriktParam,
      },
      required: [],
    },
  },
  {
    name: "mal_mot_utfall",
    description:
      "Målen för en säsong jämfört med utfallet: försäljning, antal besök, snitt per besök och modevisningar. Innehåller också vad som krävs per återstående besök för att nå säljmålet. Använd när frågan gäller mål, hur det går, eller vad som återstår.",
    inputSchema: {
      type: "object",
      properties: {
        seasonId: {
          type: "string",
          description:
            "Säsongens id från lista_sasonger. Utelämnas för den säsong som pågår nu — gör det när frågan inte nämner någon säsong.",
        },
        ...distriktParam,
      },
      required: [],
    },
  },
  {
    name: "jamfor_distrikt",
    description:
      "Alla distrikt för en säsong, rangordnade efter hur stor andel av säljmålet de nått. Använd när frågan gäller vilket distrikt som går bäst eller sämst, hur ett distrikt ligger jämfört med de andra, eller hur landet ser ut som helhet. Endast för admin.",
    inputSchema: {
      type: "object",
      properties: {
        seasonId: {
          type: "string",
          description:
            "Säsongens id från lista_sasonger. Utelämnas för den säsong som pågår nu — gör det när frågan inte nämner någon säsong.",
        },
      },
      required: [],
    },
  },
  {
    name: "ar_mot_ar",
    description:
      "Jämför en säsong med samma säsong föregående år — Höst 2026 mot Höst 2025. Använd när frågan gäller utveckling över tid: växer vi, går det bättre än förra året, hur ligger vi jämfört med i fjol. Pågår säsongen klipps fjolåret vid lika många veckor, så jämförelsen blir rättvis.",
    inputSchema: {
      type: "object",
      properties: {
        seasonId: {
          type: "string",
          description:
            "Säsongen att utgå från, från lista_sasonger. Utelämnas för den säsong som pågår nu.",
        },
        ...distriktParam,
      },
      required: [],
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
      const seasons = await seasonsNewestFirst();
      const nu = await currentSeason();
      return {
        idag: nu?.idag,
        aktuellSasong: nu?.namn,
        sasonger: seasons.map(s => ({
          seasonId: s.id,
          namn: seasonLabel(s),
          ar: s.year,
          veckor: `${s.weekStart}–${s.weekEnd}`,
          aktuell: s.id === nu?.seasonId,
        })),
      };
    }

    case "forsaljning_per_kundtyp": {
      const { districtId, label } = await resolveDistrict(scope, input.distriktsnummer as number | undefined);
      const seasonId = await resolveSeasonId(input);
      if (!seasonId) return { fel: "Det finns inga säsonger upplagda i portalen." };
      const season = await prisma.season.findUnique({ where: { id: seasonId } });
      const reports = await loadSeasonReports({ seasonId, districtId });
      const agg = toAggregateInput(reports);
      const { byType } = aggregateByType(agg, uniqueWeeks(agg));
      const totals = goalActualsFrom(byType);

      return {
        urval: label,
        sasong: season ? seasonLabel(season) : "okänd säsong",
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

      const seasonId = await resolveSeasonId(input);
      if (!seasonId) return { fel: "Det finns inga säsonger upplagda i portalen." };
      const season = await prisma.season.findUnique({ where: { id: seasonId } });
      const sasongNamn = season ? seasonLabel(season) : "okänd säsong";

      const goal = await prisma.seasonGoal.findUnique({
        where: { districtId_seasonId: { districtId, seasonId } },
      });
      if (!goal) {
        // Säg inte bara nej. Saknas målen för den säsong modellen råkade välja
        // är nästan alltid rätt svar att peka på de säsonger som faktiskt har mål.
        const andra = await prisma.seasonGoal.findMany({
          where: { districtId },
          include: { season: true },
        });
        return {
          urval: label,
          sasong: sasongNamn,
          fel: `Inga mål satta för ${sasongNamn}.`,
          sasongerMedMal: andra
            .map(g => ({ seasonId: g.seasonId, namn: seasonLabel(g.season) }))
            .sort((a, b) => a.namn.localeCompare(b.namn, "sv")),
        };
      }

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
        sasong: sasongNamn,
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

    case "jamfor_distrikt": {
      // Det här verktyget är distriktsöverskridande till sin natur och går
      // därför inte att skydda med resolveDistrict. Öppnas assistenten för FT
      // är det den här spärren som hindrar att andras siffror läcker ut.
      if (!scope.isAdmin) {
        return { fel: "Jämförelser mellan distrikt är bara tillgängliga för admin." };
      }

      const seasonId = await resolveSeasonId(input);
      if (!seasonId) return { fel: "Det finns inga säsonger upplagda i portalen." };
      const season = await prisma.season.findUnique({ where: { id: seasonId } });

      const reports = await loadSeasonReports({ seasonId });
      const agg = toAggregateInput(reports);
      const rapporterade = aggregateByDistrict(agg, uniqueWeeks(agg));

      // Distrikt som inte rapporterat något saknas i aggregeringen. De tas med
      // som nollor — ett tyst distrikt är ett svar, inte ett distrikt som inte finns.
      const alla = await prisma.district.findMany({ orderBy: { number: "asc" } });
      const perId = new Map(rapporterade.map(d => [d.id, d]));
      const rader = alla.map(d => {
        const a = perId.get(d.id);
        return {
          id: d.id,
          label: `D${d.number} – ${d.name}`,
          sales: a?.sales ?? 0,
          besok: a?.besok ?? 0,
          customers: a?.customers ?? 0,
          fashionShows: a?.fashionShows ?? 0,
        };
      });

      const goals = await prisma.seasonGoal.findMany({ where: { seasonId } });
      const rankade = rankDistricts(
        rader,
        goals.map(g => ({ districtId: g.districtId, salesTarget: g.salesTarget })),
      );

      return {
        sasong: season ? seasonLabel(season) : "okänd säsong",
        sorteringsgrund:
          "Andel av säljmålet, störst först. Distrikt utan mål ligger sist och är sorterade på försäljning.",
        distrikt: rankade.map(d => ({
          distrikt: d.label,
          forsaljning: formatSEK(Math.round(d.sales)),
          andelAvMal: d.goalPercent == null ? "inget mål satt" : `${Math.round(d.goalPercent)} %`,
          maal: d.salesTarget == null ? null : formatSEK(Math.round(d.salesTarget)),
          besok: d.besok,
          besokare: d.customers,
          snittPerBesok: formatSEK(Math.round(d.avgPerVisit)),
          modevisningar: d.fashionShows,
        })),
      };
    }

    case "ar_mot_ar": {
      const { districtId, label } = await resolveDistrict(scope, input.distriktsnummer as number | undefined);
      const seasonId = await resolveSeasonId(input);
      if (!seasonId) return { fel: "Det finns inga säsonger upplagda i portalen." };

      const innevarande = await prisma.season.findUnique({ where: { id: seasonId } });
      if (!innevarande) return { fel: "Säsongen finns inte." };

      const fjolaret = await prisma.season.findFirst({
        where: { type: innevarande.type, year: innevarande.year - 1 },
      });
      if (!fjolaret) {
        return {
          urval: label,
          sasong: seasonLabel(innevarande),
          fel: `${seasonLabel({ type: innevarande.type, year: innevarande.year - 1 })} finns inte i portalen, så det går inte att jämföra med fjolåret.`,
        };
      }

      const fönster = comparableWeeks(innevarande, fjolaret, getCurrentWeekAndYear());
      if (!fönster.innevarande || !fönster.fjolaret) {
        return {
          urval: label,
          sasong: seasonLabel(innevarande),
          fel: `${seasonLabel(innevarande)} har inte börjat ännu, så det finns inget att jämföra.`,
        };
      }

      /** Utfallet för ett veckospann. Veckorna filtreras efter hämtningen. */
      const utfall = async (id: string, från: number, till: number) => {
        const reports = await loadSeasonReports({ seasonId: id, districtId });
        const agg = toAggregateInput(reports).filter(r => r.week >= från && r.week <= till);
        const { byType } = aggregateByType(agg, uniqueWeeks(agg));
        return goalActualsFrom(byType);
      };

      const nu = await utfall(seasonId, fönster.innevarande.from, fönster.innevarande.to);
      const då = await utfall(fjolaret.id, fönster.fjolaret.from, fönster.fjolaret.to);

      const jamfor = (a: number, b: number, pengar: boolean) => ({
        iar: pengar ? formatSEK(Math.round(a)) : Math.round(a),
        ifjol: pengar ? formatSEK(Math.round(b)) : Math.round(b),
        skillnad: pengar
          ? `${a - b >= 0 ? "+" : "−"}${formatSEK(Math.abs(Math.round(a - b)))}`
          : Math.round(a - b),
        forandring:
          b > 0
            ? `${a - b >= 0 ? "+" : "−"}${Math.abs(Math.round(((a - b) / b) * 100))} %`
            : a === 0
              ? "oförändrat, noll båda åren"
              : "fanns inget i fjol att jämföra med",
      });

      return {
        urval: label,
        sasong: seasonLabel(innevarande),
        jamfortMed: seasonLabel(fjolaret),
        // Måste skrivas ut i svaret: annars låter en avkortad jämförelse som en hel.
        omfattning: fönster.pagaende
          ? `De första ${fönster.veckor} veckorna av säsongen, eftersom ${seasonLabel(innevarande)} fortfarande pågår. Fjolåret är klippt vid lika många veckor.`
          : `Hela säsongen, ${fönster.veckor} veckor.`,
        forsaljning: jamfor(nu.sales, då.sales, true),
        besok: jamfor(nu.visits, då.visits, false),
        snittPerBesok: jamfor(nu.avgPerVisit, då.avgPerVisit, true),
        modevisningar: jamfor(nu.fashionShows, då.fashionShows, false),
      };
    }

    default:
      return { fel: `Okänt verktyg: ${name}` };
  }
}

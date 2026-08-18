// Delad källa för kundtyper — används i kundlistor, rapportformulär,
// dashboard, import och Excel-export. Ändra på ett ställe i stället för sex.
//
// Kategorierna följer FT:s egen indelning i slutrapporten (fliken Rapport,
// rubrikraden). Ordningen nedan är den ordning de står i där, och den styr
// visningsordningen i hela portalen.
//
// OVRIGT står inte i FT:s lista och går INTE att välja i formulär — den saknas
// medvetet i customerTypeOptions. Men etikett och färg finns kvar, eftersom
// aggregeringen använder den som uppsamling för okända typer (se aggregate.ts)
// och en rad som ändå hamnar där måste kunna visas. Gamla filers Övrigt-kolumn
// läses numera in som Mindre försäljning (Johans beslut 2026-08-18).

export const customerTypeLabels: Record<string, string> = {
  ALDREBOENDE: "Äldreboende",
  TRAFFPUNKTER: "Träffpunkter",
  PENSIONARSFORENING: "Pensionärsförening",
  FORENING_STOD_HALSA: "Förening Stöd & Hälsoverksamhet",
  OVRIGA_FORENINGAR: "Övriga föreningar",
  FORSAMLINGSHEM: "Församlingshem arrangerat av kyrkan",
  PLUS_55: "55+",
  EGET_ARRANGEMANG: "Eget arrangemang",
  CAMPINGPLATSER: "Campingplatser",
  MINDRE_FORSALJNING: "Mindre försäljning",
  OVRIGT: "Övrigt",
};

export const customerTypeColors: Record<string, string> = {
  ALDREBOENDE: "bg-purple-100 text-purple-700",
  TRAFFPUNKTER: "bg-blue-100 text-blue-700",
  PENSIONARSFORENING: "bg-green-100 text-green-700",
  FORENING_STOD_HALSA: "bg-teal-100 text-teal-700",
  OVRIGA_FORENINGAR: "bg-lime-100 text-lime-700",
  FORSAMLINGSHEM: "bg-indigo-100 text-indigo-700",
  PLUS_55: "bg-orange-100 text-orange-700",
  EGET_ARRANGEMANG: "bg-pink-100 text-pink-700",
  CAMPINGPLATSER: "bg-cyan-100 text-cyan-700",
  MINDRE_FORSALJNING: "bg-amber-100 text-amber-700",
  OVRIGT: "bg-slate-100 text-slate-600",
};

// Hex-färger för diagram (recharts kan inte läsa Tailwind-klasser)
export const customerTypeChartColors: Record<string, string> = {
  ALDREBOENDE: "#7c3aed",
  TRAFFPUNKTER: "#2563eb",
  PENSIONARSFORENING: "#16a34a",
  FORENING_STOD_HALSA: "#0d9488",
  OVRIGA_FORENINGAR: "#65a30d",
  FORSAMLINGSHEM: "#4f46e5",
  PLUS_55: "#ea580c",
  EGET_ARRANGEMANG: "#db2777",
  CAMPINGPLATSER: "#0891b2",
  MINDRE_FORSALJNING: "#d97706",
  OVRIGT: "#64748b",
};

/** Ordnade alternativ för formulär (select-dropdowns). Samma ordning som i slutrapporten. */
export const customerTypeOptions = [
  { value: "ALDREBOENDE", label: "Äldreboende" },
  { value: "TRAFFPUNKTER", label: "Träffpunkter" },
  { value: "PENSIONARSFORENING", label: "Pensionärsförening" },
  { value: "FORENING_STOD_HALSA", label: "Förening Stöd & Hälsoverksamhet" },
  { value: "OVRIGA_FORENINGAR", label: "Övriga föreningar" },
  { value: "FORSAMLINGSHEM", label: "Församlingshem arrangerat av kyrkan" },
  { value: "PLUS_55", label: "55+" },
  { value: "EGET_ARRANGEMANG", label: "Eget arrangemang" },
  { value: "CAMPINGPLATSER", label: "Campingplatser" },
  { value: "MINDRE_FORSALJNING", label: "Mindre försäljning" },
];

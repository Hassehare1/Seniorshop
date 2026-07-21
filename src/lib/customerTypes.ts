// Delad källa för kundtyper — används i kundlistor, rapportformulär,
// dashboard och Excel-export. Ändra på ett ställe i stället för sex.

export const customerTypeLabels: Record<string, string> = {
  VARDHEM: "Vårdhem",
  FORENING: "Förening",
  TRAFFPUNKT: "Träffpunkt",
  BOENDE_55: "Boende +55",
  STOD_HALSOSAMVERKAN: "Stöd- och Hälsosamverkan",
  OVRIGT: "Övrigt",
};

export const customerTypeColors: Record<string, string> = {
  TRAFFPUNKT: "bg-blue-100 text-blue-700",
  FORENING: "bg-green-100 text-green-700",
  VARDHEM: "bg-purple-100 text-purple-700",
  BOENDE_55: "bg-orange-100 text-orange-700",
  STOD_HALSOSAMVERKAN: "bg-teal-100 text-teal-700",
  OVRIGT: "bg-slate-100 text-slate-600",
};

// Hex-färger för diagram (recharts kan inte läsa Tailwind-klasser)
export const customerTypeChartColors: Record<string, string> = {
  TRAFFPUNKT: "#2563eb",
  FORENING: "#16a34a",
  VARDHEM: "#7c3aed",
  BOENDE_55: "#ea580c",
  STOD_HALSOSAMVERKAN: "#0d9488",
  OVRIGT: "#64748b",
};

// Ordnade alternativ för formulär (select-dropdowns)
export const customerTypeOptions = [
  { value: "TRAFFPUNKT", label: "Träffpunkt" },
  { value: "FORENING", label: "Förening" },
  { value: "VARDHEM", label: "Vårdhem" },
  { value: "BOENDE_55", label: "Boende +55" },
  { value: "STOD_HALSOSAMVERKAN", label: "Stöd- och Hälsosamverkan" },
  { value: "OVRIGT", label: "Övrigt" },
];

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import * as XLSX from "xlsx";
import { medFelhantering } from "@/lib/felhantering";

// Genererar en tom Excel-mall att fylla i och ladda upp
export const GET = medFelhantering(async () => {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;

  const headers = [
    "Namn", "Typ", "Kontaktperson", "Kontaktroll",
    "Telefon", "E-post", "Adress", "Kommentar",
  ];
  const example = [
    "Träffpunkt Centrum", "Träffpunkter", "Anna Andersson", "Aktivitetsansvarig",
    "070-123 45 67", "anna@exempel.se", "Storgatan 1, Ort", "Ersätt denna exempelrad",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kunder");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="SeniorShop_kundmall.xlsx"`,
    },
  });
});

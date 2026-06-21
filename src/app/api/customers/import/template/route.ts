import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

// Genererar en tom Excel-mall att fylla i och ladda upp
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const headers = [
    "Namn", "Typ", "Kontaktperson", "Kontaktroll",
    "Telefon", "E-post", "Storlek", "Adress", "Kommentar",
  ];
  const example = [
    "Träffpunkt Centrum", "Träffpunkt", "Anna Andersson", "Aktivitetsansvarig",
    "070-123 45 67", "anna@exempel.se", 40, "Storgatan 1, Ort", "Ersätt denna exempelrad",
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
}

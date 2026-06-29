import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ImportSlutrapportClient from "./ImportSlutrapportClient";
import ResetReports from "./ResetReports";

export default async function ImportPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const districts = await prisma.district.findMany({
    orderBy: { number: "asc" },
    select: { number: true, name: true },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Importera slutrapport</h1>
        <p className="text-slate-500 text-sm mt-1">
          Ladda upp FT:s Excel-fil → granska summorna → bekräfta. En fil i taget. Inget sparas förrän du bekräftar.
        </p>
      </div>
      <ImportSlutrapportClient districts={districts} />
      <ResetReports />
    </div>
  );
}

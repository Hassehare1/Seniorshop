import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const typeLabels: Record<string, string> = {
  VARDHEM: "Vårdhem", FORENING: "Förening", TRAFFPUNKT: "Träffpunkt",
  BOENDE_55: "Boende +55", OVRIGT: "Övrigt",
};

export default async function AdminKunder() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const customers = await prisma.customer.findMany({
    include: { district: { select: { number: true } } },
    orderBy: [{ districtId: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Alla kunder</h1>
        <p className="text-slate-500 text-sm mt-1">{customers.length} kunder totalt</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[540px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">D</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Typ</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map(c => (
              <tr key={c.id} className={`hover:bg-slate-50 ${!c.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 text-slate-500 font-medium">{c.district.number}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{typeLabels[c.type] ?? c.type}</td>
                <td className="px-4 py-3 text-slate-600">{c.contactPerson ?? "–"}</td>
                <td className="px-4 py-3 text-slate-600">{c.phone ?? "–"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {c.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

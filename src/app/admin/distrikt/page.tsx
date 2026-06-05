import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminDistriktPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const districts = await prisma.district.findMany({
    include: {
      users: { select: { id: true, name: true, email: true } },
      feeConfig: true,
      _count: { select: { customers: true, reports: true } },
    },
    orderBy: { number: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Distrikt</h1>
        <p className="text-slate-500 text-sm mt-1">{districts.length} distrikt</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nr</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Region</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">FT-avgift</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">MF-avgift</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kunder</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Användare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {districts.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{d.number}</td>
                <td className="px-4 py-3 text-slate-700">{d.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{d.region}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{d.feeConfig ? `${(d.feeConfig.ftFeePercent * 100).toFixed(1)}%` : "–"}</td>
                <td className="px-4 py-3 text-slate-600">{d.feeConfig ? `${(d.feeConfig.mfFeePercent * 100).toFixed(1)}%` : "–"}</td>
                <td className="px-4 py-3 text-slate-600">{d._count.customers}</td>
                <td className="px-4 py-3 text-slate-600">
                  {d.users.map(u => u.name ?? u.email).join(", ") || "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

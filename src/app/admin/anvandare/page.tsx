import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AdminAnvandare() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    include: { district: { select: { number: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Användare</h1>
        <p className="text-slate-500 text-sm mt-1">{users.length} användare</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-post</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Roll</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Distrikt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.name ?? "–"}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${u.role === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {u.role === "ADMIN" ? "Admin" : "Franchisetagare"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {u.district ? `D${u.district.number} – ${u.district.name}` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

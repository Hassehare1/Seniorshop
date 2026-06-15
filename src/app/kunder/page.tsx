import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import KunderClient from "./KunderClient";

export default async function KunderPage() {
  const session = await auth();
  if (!session?.user.districtId) redirect("/dashboard");

  const customers = await prisma.customer.findMany({
    where: { districtId: session.user.districtId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mina kunder</h1>
          <p className="text-slate-500 text-sm mt-1">
            Distrikt {session.user.districtNumber} — {customers.filter(c => c.active).length} aktiva
          </p>
        </div>
      </div>
      <KunderClient customers={customers} districtId={session.user.districtId} />
    </div>
  );
}

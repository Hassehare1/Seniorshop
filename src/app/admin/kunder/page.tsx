import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminKunderClient from "./AdminKunderClient";

export default async function AdminKunder() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const customers = await prisma.customer.findMany({
    include: { district: { select: { number: true, name: true } } },
    orderBy: [{ district: { number: "asc" } }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Alla kunder</h1>
        <p className="text-slate-500 text-sm mt-1">{customers.length} kunder totalt</p>
      </div>
      <AdminKunderClient customers={customers} />
    </div>
  );
}

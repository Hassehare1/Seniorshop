import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AnvandareClient from "./AnvandareClient";

export default async function AdminAnvandare() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const [users, districts] = await Promise.all([
    prisma.user.findMany({
      include: { district: { select: { number: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.district.findMany({ orderBy: { number: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Användare</h1>
      </div>
      <AnvandareClient users={users} districts={districts} />
    </div>
  );
}

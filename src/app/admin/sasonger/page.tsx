import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SasongerClient from "./SasongerClient";

export default async function AdminSasongerPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const seasons = await prisma.season.findMany({
    orderBy: [{ year: "desc" }, { type: "desc" }],
    include: { _count: { select: { reports: true } } },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Säsonger</h1>
        <p className="text-slate-500 text-sm mt-1">Hantera rapporteringssäsonger</p>
      </div>
      <SasongerClient seasons={seasons} />
    </div>
  );
}

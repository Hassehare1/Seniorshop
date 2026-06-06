import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import LoggClient from "./LoggClient";

export default async function LoggPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const serialized = logs.map(l => ({
    id: l.id,
    action: l.action,
    userEmail: l.userEmail,
    details: l.details,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Händelselogg</h1>
        <p className="text-slate-500 text-sm mt-1">Senaste {logs.length} händelserna</p>
      </div>
      <LoggClient logs={serialized} />
    </div>
  );
}

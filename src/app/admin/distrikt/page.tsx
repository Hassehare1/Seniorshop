import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DistriktClient from "./DistriktClient";

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

  return <DistriktClient districts={districts} />;
}

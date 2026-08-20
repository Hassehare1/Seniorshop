import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DistriktClient from "./DistriktClient";
import { toNumber } from "@/lib/fees";

export default async function AdminDistriktPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const districts = await prisma.district.findMany({
    include: {
      users: { select: { id: true, name: true, email: true } },
      feeConfig: true,
      _count: { select: { customers: true, reports: true } },
    },
    orderBy: { number: "asc" },
  });

  // mfFeeCap är Decimal i databasen och kan inte serialiseras till en
  // klientkomponent — konvertera vid gränsen (visas som vanligt belopp).
  const forClient = districts.map(d => ({
    ...d,
    feeConfig: d.feeConfig ? { ...d.feeConfig, mfFeeCap: toNumber(d.feeConfig.mfFeeCap) } : null,
  }));

  return <DistriktClient districts={forClient} />;
}

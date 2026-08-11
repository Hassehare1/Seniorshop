import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SpelClient from "./SpelClient";

export default async function SpelPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Modevisningsbingo</h1>
        <p className="text-slate-500 text-sm mt-1">
          Testversion — sidan syns bara för admin. Tanken är att damerna spelar den i telefonen
          under visningen, men så länge den ligger bakom inloggning når de den inte.
        </p>
      </div>
      <SpelClient />
    </div>
  );
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfilClient from "./ProfilClient";

export default async function ProfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Min profil</h1>
        <p className="text-slate-500 text-sm mt-1">{session.user.email}</p>
      </div>
      <ProfilClient />
    </div>
  );
}

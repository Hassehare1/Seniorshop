import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import ProfilClient from "./ProfilClient";
import ThemeToggle from "./ThemeToggle";
import { THEME_COOKIE, DEFAULT_THEME, isTheme } from "@/lib/theme";

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const initialTheme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Min profil</h1>
        <p className="text-slate-500 text-sm mt-1">{session.user.email}</p>
      </div>
      <ThemeToggle initialTheme={initialTheme} />
      <ProfilClient />
    </div>
  );
}

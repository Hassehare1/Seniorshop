import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AssistentClient from "./AssistentClient";

export default async function AssistentPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const harNyckel = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Fråga portalen</h1>
        <p className="text-slate-500 text-sm mt-1">
          Ställ en fråga i fri text. Portalen räknar, modellen formulerar svaret.
        </p>
      </div>

      {!harNyckel && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 max-w-2xl">
          <p className="text-sm font-medium text-amber-900">API-nyckel saknas</p>
          <p className="text-sm text-amber-800 mt-0.5">
            Lägg in <code className="font-mono">ANTHROPIC_API_KEY</code> bland miljövariablerna i
            Vercel, så fungerar sidan. Allt annat är på plats.
          </p>
        </div>
      )}

      {/* Samma upplägg som Modevisningsbingo: admin-låst medan det mognar. */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 max-w-2xl">
        <p className="text-sm text-slate-600">
          Försök, bara för admin. Siffrorna hämtas alltid ur databasen — modellen väljer vilken
          fråga som ska ställas och skriver svaret, men räknar aldrig själv. Den kan svara på
          försäljning per kundtyp, mål mot utfall, hur distrikten ligger mot varandra och år mot
          år; allt annat säger den ifrån om.
        </p>
      </div>

      <AssistentClient />
    </div>
  );
}

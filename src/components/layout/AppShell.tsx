import Sidebar from "@/components/layout/Sidebar";

/**
 * Portalens yttre skal: sidomeny till vänster, innehåll till höger.
 *
 * Fanns tidigare kopierat ordagrant i sju layout.tsx-filer. Kopiorna hade
 * hunnit glida isär på två sätt utan att någon bestämt det:
 *
 *   dashboard hade md:pt-8 där de sex andra hade md:pt-0
 *   forsaljning och kunder hade print-klasser som de andra saknade
 *
 * Toppmarginalen är rättad till md:pt-0 — det sex av sju gjorde, och det som
 * ser rätt ut. Utskriftsklasserna är kvar men styrs nu av en prop, eftersom
 * de sidorna faktiskt skrivs ut och de andra inte.
 *
 * h-screen + overflow-hidden är avsiktligt: utan det scrollar hela sidan som
 * en remsa och sidomenyn följer med bort på innehållstunga sidor. Bara
 * innehållsytan ska rulla. Utskrift undantas — där ska allt flöda.
 */
export default function AppShell({
  children,
  utskriftsvanlig = false,
}: {
  children: React.ReactNode;
  /** Sätt på sidor som faktiskt skrivs ut (Försäljning, Kunder). */
  utskriftsvanlig?: boolean;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 print:h-auto print:overflow-visible">
      <Sidebar />
      <main
        className={
          "flex-1 pt-14 px-4 pb-6 md:pt-0 md:px-8 md:pb-8 overflow-auto min-w-0 min-h-0" +
          (utskriftsvanlig ? " print:pt-0 print:px-0" : "")
        }
      >
        {children}
      </main>
    </div>
  );
}

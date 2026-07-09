import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatSEK } from "@/lib/fees";
import { customerTypeLabels, customerTypeColors } from "@/lib/customerTypes";
import PrintButton from "./PrintButton";
import ContactCard from "./ContactCard";

export default async function CustomerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id: rawId } = await params;
  // Tål specialtecken i id (ä/ö/å): avkoda URL + testa båda Unicode-formerna (NFC/NFD)
  let decoded = rawId;
  try { decoded = decodeURIComponent(rawId); } catch { /* lämna oavkodat */ }
  const idCandidates = Array.from(new Set([decoded, decoded.normalize("NFC"), decoded.normalize("NFD")]));

  const customer = await prisma.customer.findFirst({
    where: { id: { in: idCandidates } },
    include: {
      district: { select: { number: true, name: true } },
      visits: {
        include: {
          report: { select: { week: true, season: { select: { type: true, year: true } } } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!customer) notFound();

  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && session.user.districtId !== customer.districtId) redirect("/kunder");

  const visits = customer.visits;
  const totalSales = visits.reduce((s, v) => s + v.sales + v.fashionShowSales, 0);
  const totalCustomers = visits.reduce((s, v) => s + v.numberOfCustomers, 0);
  const besok = visits.length;
  const snittkvitto = totalCustomers > 0 ? totalSales / totalCustomers : null;

  const latest = visits[0] ?? null;
  const latestSale = latest ? latest.sales + latest.fashionShowSales : null;
  const latestLabel = latest
    ? `${latest.report.season.type === "VAR" ? "Vår" : "Höst"} ${latest.report.season.year} · v${latest.report.week}`
    : null;
  const lastVisitDate = latest
    ? new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "short", day: "numeric" }).format(latest.createdAt)
    : null;

  const backHref = isAdmin ? "/admin/kunder" : "/kunder";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={backHref} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
          ← Tillbaka
        </Link>
        <PrintButton />
      </div>

      {/* Rubrik */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{customer.name}</h1>
            <p className="text-slate-500 text-sm mt-1">
              <span className="font-medium text-slate-600">D{customer.district.number}-{customer.customerNumber}</span> · {customer.district.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${customerTypeColors[customer.type] ?? "bg-slate-100 text-slate-600"}`}>
              {customerTypeLabels[customer.type] ?? customer.type}
            </span>
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${customer.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {customer.active ? "Aktiv" : "Inaktiv"}
            </span>
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${customer.approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {customer.approved ? "Godkänd" : "Väntar granskning"}
            </span>
          </div>
        </div>
      </div>

      {/* Kontaktuppgifter — redigerbara inline (FT + admin på egna kunder) */}
      <ContactCard
        customerId={customer.id}
        initial={{
          contactPerson: customer.contactPerson ?? "",
          contactRole: customer.contactRole ?? "",
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          size: customer.size != null ? String(customer.size) : "",
          address: customer.address ?? "",
          notes: customer.notes ?? "",
        }}
      />

      {/* Försäljning & nyckeltal */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Försäljning</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          <Stat
            label="Senaste försäljning"
            value={latestSale != null ? formatSEK(latestSale) : "–"}
            sub={latestLabel ?? "Inga besök ännu"}
          />
          <Stat label="Total försäljning" value={formatSEK(totalSales)} sub="alla säsonger" />
          <Stat label="Antal besök" value={String(besok)} sub={lastVisitDate ? `senast ${lastVisitDate}` : "–"} />
          <Stat label="Snittkvitto" value={snittkvitto != null ? formatSEK(snittkvitto) : "–"} sub="per kund" />
        </div>
      </div>

      {/* Budget — placeholder tills kundens siffror finns (döljs vid utskrift) */}
      <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-5 md:p-6 print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-600">Budget</h2>
            <p className="text-xs text-slate-400 mt-1">Visas här när budgetsiffror finns från kund.</p>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-white border border-slate-200 rounded-full px-3 py-1 whitespace-nowrap">
            Kommer
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 opacity-50 pointer-events-none select-none">
          <Stat label="Budget" value="– kr" sub="säsong" />
          <Stat label="Utfall mot budget" value="– %" sub="hittills" />
          <Stat label="Kvar att sälja" value="– kr" sub="till mål" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-lg md:text-xl font-bold text-slate-800 mt-0.5 truncate">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

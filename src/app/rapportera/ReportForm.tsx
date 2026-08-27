"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useId } from "react";
import { calculateFees, formatSEK, money, sumMoney, type FeeConfig } from "@/lib/fees";
import { getISOWeek } from "@/lib/week";
import type { Customer, Season } from "@prisma/client";
import VisitRow, { type VisitRowData, type VisitStatus } from "./VisitRow";

// Stabil nyckel per rad. Med listindex som React-nyckel återanvänds
// komponenten på positionen när en rad tas bort, och behåller sitt interna
// tillstånd (kundnamnet i sökfältet) — det såg ut som att det borttagna
// besöket kom tillbaka.
let rowKeySeq = 0;
const nextRowKey = () => `rad-${++rowKeySeq}`;

function seasonLabel(season: Season | undefined | null): string {
  if (!season) return "en annan säsong";
  return `${season.type === "VAR" ? "Vår" : "Höst"} ${season.year}`;
}

interface Props {
  customers: Customer[];
  seasons: Season[];
  currentSeason: Season | null;
  existingReports: { week: number; status: string; id: string }[];
  districtId: string;
  feeConfig: Pick<FeeConfig, "ftFeePercent" | "mfFeePercent" | "mfFeeCap" | "vatMultiplier">;
  initialWeek?: number;
  initialSeasonId?: string;
}

export default function ReportForm({
  customers,
  seasons,
  currentSeason,
  existingReports,
  districtId,
  feeConfig,
  initialWeek,
  initialSeasonId,
}: Props) {
  const uid = useId();
  const router = useRouter();
  const [selectedSeasonId] = useState(
    initialSeasonId ?? currentSeason?.id ?? ""
  );
  const startWeek = (() => {
    const season = seasons.find(s => s.id === (initialSeasonId ?? currentSeason?.id)) ?? currentSeason;
    const week = initialWeek ?? getISOWeek();
    if (!season) return week;
    return Math.min(Math.max(week, season.weekStart), season.weekEnd);
  })();
  const [selectedWeek, setSelectedWeek] = useState<number>(startWeek);
  const [reports, setReports] = useState(existingReports);
  const [visits, setVisits] = useState<VisitRowData[]>([]);
  // Ögonblicksbild av vad som ligger sparat i databasen för den valda veckan.
  // Jämförs mot formulärets rader för att visa Sparad/Ändrad/Ny.
  const [savedVisits, setSavedVisits] = useState<VisitRowData[]>([]);
  // Laddningen börjar direkt vid montering om veckan har en sparad rapport.
  // Flaggan sätts av det som ORSAKAR laddningen — montering respektive
  // veckobyte — inte inne i effekten som utför den.
  const [loadingVisits, setLoadingVisits] = useState(
    () => existingReports.some(r => r.week === startWeek)
  );
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Hålls som sträng — JSON saknar exakt decimaltyp; läses in i Decimal vid bruk.
  const [mfAccumulated, setMfAccumulated] = useState("0.00");
  const [isDirty, setIsDirty] = useState(false);
  const [pendingWeek, setPendingWeek] = useState<number | null>(null);
  const [pendingSeasonId, setPendingSeasonId] = useState<string | null>(null);

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId) ?? currentSeason;
  const weekStart = selectedSeason?.weekStart ?? 1;
  const weekEnd = selectedSeason?.weekEnd ?? 52;

  const currentReport = reports.find(r => r.week === selectedWeek) ?? null;
  const currentStatus = currentReport?.status ?? "DRAFT";
  const isLocked = currentStatus === "SUBMITTED" || currentStatus === "APPROVED";
  const isApproved = currentStatus === "APPROVED";
  const reportId = currentReport?.id ?? savedReportId;

  useEffect(() => {
    fetch(
      `/api/reports/mf-accumulated?districtId=${districtId}&seasonId=${selectedSeasonId}&week=${selectedWeek}`
    )
      .then((r) => r.json())
      .then((d) => setMfAccumulated(String(d.accumulated ?? "0.00")))
      .catch(() => {});
  }, [selectedSeasonId, selectedWeek, districtId]);

  // Hämtar besöken för en redan rapporterad vecka. Effekten synkroniserar bara
  // mot servern; tömning av formuläret och laddningsflaggan sköts där bytet
  // sker (applyWeekChange), så att inget state sätts synkront här.
  useEffect(() => {
    if (!weekStatusMap.has(selectedWeek)) return;
    let aktuell = true;
    fetch(`/api/reports?districtId=${districtId}&seasonId=${selectedSeasonId}`)
      .then(r => r.json())
      .then((fetched: { week: number; visits: (VisitRowData & { id: string })[] }[]) => {
        // Hann man byta vecka igen medan svaret var på väg är det inaktuellt.
        if (!aktuell) return;
        const report = fetched.find(r => r.week === selectedWeek);
        if (report) {
          const loaded = report.visits.map(v => ({
            _key: nextRowKey(),
            customerId: v.customerId,
            numberOfCustomers: v.numberOfCustomers,
            sales: v.sales,
            isFashionShow: v.isFashionShow,
            isHangerShow: v.isHangerShow,
            isSale: v.isSale,
            comment: v.comment ?? "",
          }));
          setVisits(loaded);
          setSavedVisits(loaded);
          setIsDirty(false);
        }
      })
      .catch(() => { if (aktuell) setLoadError("Kunde inte ladda rapporten. Försök igen."); })
      .finally(() => { if (aktuell) setLoadingVisits(false); });
    return () => { aktuell = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, selectedSeasonId, districtId]);

  // Varna innan fliken stängs/laddas om med osparade ändringar — en hel veckas
  // inmatning ska inte kunna försvinna på ett felklick. (Vecko-byte inom sidan
  // har redan egen varning nedan.)
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Begär vecko-byte — visar varning om det finns osparade ändringar
  /**
   * Säsongsbytet går via URL:en i stället för att bara ändra state.
   *
   * Listan över rapporterade veckor hämtas på servern för den säsong sidan
   * renderas med. Byttes säsongen enbart i klienten låg gammal säsongs lista
   * kvar: veckorna såg orapporterade ut, besöken laddades aldrig, och en
   * godkänd vecka visades som olåst. Servern får avgöra.
   */
  function requestSeasonChange(newSeasonId: string) {
    if (newSeasonId === selectedSeasonId) return;
    if (isDirty && visits.length > 0) {
      setPendingSeasonId(newSeasonId);
    } else {
      applySeasonChange(newSeasonId);
    }
  }

  function applySeasonChange(newSeasonId: string) {
    setPendingSeasonId(null);
    setIsDirty(false);
    // Ingen vecka i länken — den nya säsongen har sitt eget veckointervall och
    // formuläret klampar veckan när det monteras om.
    router.push(`/rapportera?season=${newSeasonId}`);
  }

  function requestWeekChange(newWeek: number) {
    if (isDirty && visits.length > 0) {
      setPendingWeek(newWeek);
    } else {
      applyWeekChange(newWeek);
    }
  }

  function applyWeekChange(newWeek: number) {
    const rapporterad = weekStatusMap.has(newWeek);
    setSelectedWeek(newWeek);
    setSavedReportId(null);
    setIsDirty(false);
    setPendingWeek(null);
    setLoadError("");
    // Har veckan en sparad rapport hämtar effekten den härnäst — visa "laddar"
    // så länge. Annars är veckan tom, och formuläret nollställs direkt.
    setLoadingVisits(rapporterad);
    if (!rapporterad) { setVisits([]); setSavedVisits([]); }
  }

  function addVisit() {
    setVisits((v) => {
      // Förvälj första kunden som INTE redan ligger på veckan — annars skapar
      // ett tillagt besök en dubblett direkt, utan att man gjort något fel.
      const taken = new Set(v.map(x => x.customerId).filter(Boolean));
      const firstFree = customers.find(c => !taken.has(c.id));
      return [
        ...v,
        {
          _key: nextRowKey(),
          customerId: firstFree?.id ?? "",
          numberOfCustomers: 0,
          sales: 0,
          isFashionShow: false,
          isHangerShow: false,
          isSale: false,
          comment: "",
        },
      ];
    });
    setIsDirty(true);
  }

  function updateVisit(i: number, field: keyof VisitRowData, value: unknown) {
    setVisits((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
    setIsDirty(true);
  }

  // "Ta bort" sparar direkt. Tidigare togs raden bara bort ur formuläret och
  // krävde ett extra "Spara utkast" — glömde man det låg besöket kvar och kom
  // tillbaka vid omladdning, vilket såg ut som att borttagningen inte fungerade.
  // Rör bara veckor som redan är sparade; är inget sparat finns inget att skriva.
  async function removeVisit(i: number) {
    const next = visits.filter((_, idx) => idx !== i);
    setVisits(next);
    if (savedVisits.length === 0) {
      setIsDirty(true);
      return;
    }
    await persistVisits(next);
  }

  // Avgifterna räknas i Decimal även här — samma funktion som servern använder,
  // så förhandsvisningen visar exakt det som sedan lagras.
  let runningMf = money(mfAccumulated);
  const feeRows = visits.map((v) => {
    const fees = calculateFees(money(v.sales), runningMf, feeConfig as FeeConfig);
    runningMf = fees.mfFeeAccumulated;
    return fees;
  });

  // En rad matchas mot ögonblicksbilden på kund — en kund rapporteras en gång
  // per vecka, så kund-id räcker som nyckel.
  function visitStatus(v: VisitRowData): VisitStatus {
    if (!v.customerId) return "new";
    const saved = savedVisits.find(s => s.customerId === v.customerId);
    if (!saved) return "new";
    const same =
      saved.numberOfCustomers === v.numberOfCustomers &&
      Number(saved.sales) === Number(v.sales) &&
      saved.isFashionShow === v.isFashionShow &&
      saved.isHangerShow === v.isHangerShow &&
      saved.isSale === v.isSale &&
      (saved.comment ?? "") === (v.comment ?? "");
    return same ? "saved" : "changed";
  }

  const savedTotal = sumMoney(savedVisits.map(v => v.sales));

  const totals = {
    sales: sumMoney(visits.map((v) => v.sales)),
    ftFee: sumMoney(feeRows.map((f) => f.ftFee)),
    mfFee: sumMoney(feeRows.map((f) => f.mfFee)),
    totalToPay: sumMoney(feeRows.map((f) => f.totalToPay)),
  };

  // Skickar en lista besök till servern och speglar svaret i sparat läge.
  // Avgifterna räknas om server-sidan, så klientens värden behöver inte med.
  async function persistVisits(list: VisitRowData[]) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId,
          seasonId: selectedSeasonId,
          week: selectedWeek,
          // _key är bara React-nyckel på klienten och ska inte skickas med
          visits: list.map(({ _key, ...v }) => v),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { id, deleted } = await res.json();
      setIsDirty(false);

      if (deleted) {
        // Sista besöket togs bort → veckan är inte längre rapporterad.
        setSavedVisits([]);
        setSavedReportId(null);
        setReports(prev => prev.filter(r => r.week !== selectedWeek));
        return;
      }

      setSavedReportId(id);
      // Det som just skickades in är nu det sparade läget — raderna blir "Sparad".
      setSavedVisits(list.map(v => ({ ...v })));
      // Besöken lämnas KVAR på skärmen. Tidigare tömdes formuläret här, vilket
      // gjorde att man inte såg vad man just sparat — och därmed lätt kunde
      // rapportera samma kund en gång till.
      setReports(prev => {
        const exists = prev.some(r => r.week === selectedWeek);
        if (exists) return prev.map(r => r.week === selectedWeek ? { ...r, id, status: "DRAFT" } : r);
        return [...prev, { id, week: selectedWeek, status: "DRAFT" }];
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    // Tom vecka får sparas när något ligger sparat — det är så man tar bort
    // veckans sista besök. Servern raderar då hela veckorapporten.
    if (!visits.length && savedVisits.length === 0) return;
    await persistVisits(visits);
  }

  async function handleLockToggle() {
    if (!reportId) return;
    setLocking(true);
    setError("");
    try {
      const newStatus = currentStatus === "SUBMITTED" ? "DRAFT" : "SUBMITTED";
      const res = await fetch(`/api/reports/${reportId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      setReports(prev => prev.map(r => r.week === selectedWeek ? { ...r, status: newStatus } : r));
      setSavedReportId(reportId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setLocking(false);
    }
  }

  const weekStatusMap = new Map(reports.map(r => [r.week, r.status]));
  const weeks = Array.from({ length: weekEnd - weekStart + 1 }, (_, i) => i + weekStart);

  return (
    <div className="space-y-6">
      {/* Osparade ändringar — bekräftelse */}
      {(pendingWeek !== null || pendingSeasonId !== null) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-amber-800 text-sm flex-1">
            Du har osparade ändringar — byt till{" "}
            {pendingWeek !== null
              ? `vecka ${pendingWeek}`
              : seasonLabel(seasons.find(s => s.id === pendingSeasonId))}{" "}
            ändå?
          </span>
          <button
            onClick={() => pendingWeek !== null ? applyWeekChange(pendingWeek) : applySeasonChange(pendingSeasonId!)}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Byt ändå
          </button>
          <button
            onClick={() => { setPendingWeek(null); setPendingSeasonId(null); }}
            className="text-amber-700 hover:text-amber-900 text-xs font-medium px-2 py-1.5 transition-colors"
          >
            Avbryt
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-wrap gap-4 items-end">
          {seasons.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`${uid}-sasong`}>Säsong</label>
              <select id={`${uid}-sasong`}
                value={selectedSeasonId}
                onChange={e => requestSeasonChange(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {seasons.map(s => (
                  <option key={s.id} value={s.id}>
                    {seasonLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor={`${uid}-vecka`} className="block text-sm font-medium text-slate-700 mb-1">Vecka</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => requestWeekChange(Math.max(weekStart, selectedWeek - 1))}
                disabled={selectedWeek <= weekStart}
                aria-label="Föregående vecka"
                className="w-8 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none"
              >
                ‹
              </button>
              <select id={`${uid}-vecka`}
                value={selectedWeek}
                onChange={(e) => requestWeekChange(Number(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {weeks.map((w) => {
                  const st = weekStatusMap.get(w);
                  const marker = st === "APPROVED" ? " ✓" : st === "SUBMITTED" ? " 🔒" : st === "DRAFT" ? " ✏" : "";
                  return (
                    <option key={w} value={w}>Vecka {w}{marker}</option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => requestWeekChange(Math.min(weekEnd, selectedWeek + 1))}
                disabled={selectedWeek >= weekEnd}
                aria-label="Nästa vecka"
                className="w-8 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-wrap items-center gap-2 justify-between">
          <h2 className="font-semibold text-slate-700">Besök vecka {selectedWeek}</h2>
          {isApproved && (
            <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg font-medium">
              🔒 Godkänd av admin — kontakta admin för ändringar
            </span>
          )}
          {currentStatus === "SUBMITTED" && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-medium">
              🔒 Låst — lås upp för att redigera
            </span>
          )}
        </div>

        {/* Vad som redan ligger sparat på veckan — syns innan man börjar fylla i,
            så man inte råkar rapportera samma kund en gång till. */}
        {!loadingVisits && savedVisits.length > 0 && (
          <div className="mx-4 md:mx-6 mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">
                {savedVisits.length === 1
                  ? "1 besök redan sparat denna vecka"
                  : `${savedVisits.length} besök redan sparade denna vecka`}
              </span>
              <span className="text-blue-700"> · {formatSEK(savedTotal)}</span>
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              {isDirty
                ? "Du har ändringar som inte är sparade än."
                : "Redigera en befintlig rad i stället för att lägga till samma kund igen."}
            </p>
          </div>
        )}

        {loadingVisits && (
          <div className="p-12 text-center text-slate-400 text-sm">Laddar tidigare rapport...</div>
        )}

        {loadError && (
          <div className="mx-4 md:mx-6 mt-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {loadError}
          </div>
        )}

        {!loadingVisits && visits.length === 0 && customers.length === 0 && (
          <div className="p-12 text-center text-sm">
            <p className="text-slate-500">Inga kunder registrerade i ditt distrikt än.</p>
            <Link href="/kunder" className="inline-block mt-2 text-blue-600 hover:text-blue-700 font-medium">
              Lägg till din första kund →
            </Link>
          </div>
        )}

        {!loadingVisits && visits.length === 0 && customers.length > 0 && (
          <div className="p-12 text-center text-slate-400 text-sm">
            Klicka &quot;Lägg till besök&quot; för att börja rapportera.
          </div>
        )}

        <div className={`divide-y divide-slate-100 ${isLocked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          {visits.map((visit, i) => (
            <VisitRow
              key={visit._key}
              index={i}
              visit={visit}
              customers={customers}
              feeRow={feeRows[i] ?? null}
              status={visitStatus(visit)}
              takenCustomerIds={new Set(visits.filter((_, idx) => idx !== i).map(v => v.customerId).filter(Boolean))}
              onUpdate={(field, value) => updateVisit(i, field, value)}
              onRemove={() => removeVisit(i)}
            />
          ))}
        </div>

        {!isLocked && customers.length > 0 && (
          <div className="p-6 border-t border-slate-100">
            <button
              type="button"
              onClick={addVisit}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Lägg till besök
            </button>
          </div>
        )}
      </div>

      {visits.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Summering vecka {selectedWeek}
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Total försäljning</p>
              <p className="font-bold text-slate-800">{formatSEK(totals.sales)}</p>
            </div>
            <div>
              <p className="text-slate-500">Totalt att betala</p>
              <p className="font-bold text-blue-700 text-lg">
                {formatSEK(totals.totalToPay)}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}

      {/* Sparad-bekräftelse (utan Excel-knapp — finns i knapprad nedan) */}
      {savedReportId && !isLocked && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-green-700 text-sm font-medium">Rapporten sparades!</p>
        </div>
      )}

      {(visits.length > 0 || currentReport || savedReportId) && (
        <div className="flex flex-wrap gap-3 items-center">
          {/* Spara utkast */}
          {!isLocked && (
            <button
              onClick={handleSubmit}
              disabled={saving || (visits.length === 0 && savedVisits.length === 0)}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              {saving ? "Sparar..." : "Spara utkast"}
            </button>
          )}

          {/* Lämna in / Återta */}
          {!isApproved && (currentReport || savedReportId) && (
            <button
              onClick={handleLockToggle}
              disabled={locking}
              className={`font-medium px-6 py-2.5 rounded-lg transition-colors ${
                currentStatus === "SUBMITTED"
                  ? "bg-amber-100 hover:bg-amber-200 text-amber-800"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {locking ? "..." : currentStatus === "SUBMITTED" ? "🔓 Återta rapport" : "✓ Lämna in rapport"}
            </button>
          )}

          {/* Excel — alltid synlig när rapporten finns sparad (oavsett status) */}
          {reportId && (
            <a
              href={`/api/reports/${reportId}/export`}
              download
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Ladda ner Excel
            </a>
          )}
        </div>
      )}
    </div>
  );
}

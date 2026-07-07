"use client";

import { useState, useEffect, useRef } from "react";
import { calculateFees, formatSEK, type FeeConfig } from "@/lib/fees";
import { customerTypeLabels } from "@/lib/customerTypes";
import { getISOWeek } from "@/lib/week";
import type { Customer, Season } from "@prisma/client";

interface VisitRow {
  customerId: string;
  numberOfCustomers: number;
  sales: number;
  isFashionShow: boolean;
  fashionShowSales: number;
  isHangerShow: boolean;
  comment: string;
}

interface VisitRowProps {
  index: number;
  visit: VisitRow;
  customers: Customer[];
  feeRow: { ftFee: number; mfFee: number; totalToPay: number } | null;
  onUpdate: (field: keyof VisitRow, value: unknown) => void;
  onRemove: () => void;
}

function VisitRow({ index, visit, customers, feeRow, onUpdate, onRemove }: VisitRowProps) {
  const [inputValue, setInputValue] = useState(() => customers.find(c => c.id === visit.customerId)?.name ?? "");
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = inputValue === ""
    ? customers
    : customers.filter(c =>
        c.name.toLowerCase().includes(inputValue.toLowerCase()) ||
        customerTypeLabels[c.type]?.toLowerCase().includes(inputValue.toLowerCase())
      );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const selected = customers.find(c => c.id === visit.customerId);
        setInputValue(selected?.name ?? "");
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [customers, visit.customerId]);

  function selectCustomer(id: string, name: string) {
    onUpdate("customerId", id);
    setInputValue(name);
    setOpen(false);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">Besök {index + 1}</span>
        {confirmRemove ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Ta bort besöket?</span>
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-600 font-semibold hover:text-red-800"
            >
              Ja
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Nej
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Ta bort
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 relative" ref={ref}>
          <label className="block text-xs font-medium text-slate-600 mb-1">Kund</label>
          <input
            type="text"
            value={inputValue}
            placeholder="Sök kund..."
            onFocus={() => { setInputValue(""); setOpen(true); }}
            onChange={e => { setInputValue(e.target.value); setOpen(true); }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {open && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-400">Inga kunder hittades</p>
              )}
              {filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => selectCustomer(c.id, c.name)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between items-center ${c.id === visit.customerId ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{customerTypeLabels[c.type]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Antal kunder</label>
          <input
            type="number"
            min={0}
            value={visit.numberOfCustomers === 0 ? "" : visit.numberOfCustomers}
            placeholder="0"
            onChange={e => onUpdate("numberOfCustomers", e.target.value === "" ? 0 : Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Försäljning (ink. moms)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={visit.sales === 0 ? "" : visit.sales}
            placeholder="0"
            onChange={e => onUpdate("sales", e.target.value === "" ? 0 : Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={visit.isFashionShow}
              onChange={e => onUpdate("isFashionShow", e.target.checked)}
              className="rounded"
            />
            Modevisning
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={visit.isHangerShow}
              onChange={e => onUpdate("isHangerShow", e.target.checked)}
              className="rounded"
            />
            Visning på galge
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Kommentar</label>
          <textarea
            value={visit.comment}
            rows={2}
            placeholder="Valfri notering om besöket"
            onChange={e => onUpdate("comment", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {feeRow && (
        <div className="bg-slate-50 rounded-lg px-4 py-2 text-xs text-slate-500 flex gap-6">
          <span>FT-avgift: {formatSEK(feeRow.ftFee)}</span>
          <span className="font-medium text-slate-700">Att betala: {formatSEK(feeRow.totalToPay)}</span>
        </div>
      )}
    </div>
  );
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
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    initialSeasonId ?? currentSeason?.id ?? ""
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    const season = seasons.find(s => s.id === (initialSeasonId ?? currentSeason?.id)) ?? currentSeason;
    const week = initialWeek ?? getISOWeek();
    if (!season) return week;
    return Math.min(Math.max(week, season.weekStart), season.weekEnd);
  });
  const [reports, setReports] = useState(existingReports);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mfAccumulated, setMfAccumulated] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingWeek, setPendingWeek] = useState<number | null>(null);

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
      .then((d) => setMfAccumulated(d.accumulated ?? 0))
      .catch(() => {});
  }, [selectedSeasonId, selectedWeek, districtId]);

  // Ladda befintliga besök när man byter till en redan rapporterad vecka
  useEffect(() => {
    const isReported = weekStatusMap.has(selectedWeek);
    if (!isReported) { setVisits([]); setLoadError(""); setIsDirty(false); return; }
    setLoadingVisits(true);
    setLoadError("");
    fetch(`/api/reports?districtId=${districtId}&seasonId=${selectedSeasonId}`)
      .then(r => r.json())
      .then((fetched: { week: number; visits: (VisitRow & { id: string })[] }[]) => {
        const report = fetched.find(r => r.week === selectedWeek);
        if (report) {
          setVisits(report.visits.map(v => ({
            customerId: v.customerId,
            numberOfCustomers: v.numberOfCustomers,
            sales: v.sales,
            isFashionShow: v.isFashionShow,
            fashionShowSales: v.fashionShowSales,
            isHangerShow: v.isHangerShow,
            comment: v.comment ?? "",
          })));
          setIsDirty(false);
        }
      })
      .catch(() => { setLoadError("Kunde inte ladda rapporten. Försök igen."); })
      .finally(() => setLoadingVisits(false));
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
  function requestWeekChange(newWeek: number) {
    if (isDirty && visits.length > 0) {
      setPendingWeek(newWeek);
    } else {
      applyWeekChange(newWeek);
    }
  }

  function applyWeekChange(newWeek: number) {
    setSelectedWeek(newWeek);
    setSavedReportId(null);
    setIsDirty(false);
    setPendingWeek(null);
  }

  function addVisit() {
    setVisits((v) => [
      ...v,
      {
        customerId: customers[0]?.id ?? "",
        numberOfCustomers: 0,
        sales: 0,
        isFashionShow: false,
        fashionShowSales: 0,
        isHangerShow: false,
        comment: "",
      },
    ]);
    setIsDirty(true);
  }

  function updateVisit(i: number, field: keyof VisitRow, value: unknown) {
    setVisits((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
    setIsDirty(true);
  }

  function removeVisit(i: number) {
    setVisits((v) => v.filter((_, idx) => idx !== i));
    setIsDirty(true);
  }

  let runningMf = mfAccumulated;
  const feeRows = visits.map((v) => {
    const fees = calculateFees(v.sales + v.fashionShowSales, runningMf, feeConfig as FeeConfig);
    runningMf = fees.mfFeeAccumulated;
    return fees;
  });

  const totals = {
    sales: visits.reduce((s, v) => s + v.sales + v.fashionShowSales, 0),
    ftFee: feeRows.reduce((s, f) => s + f.ftFee, 0),
    mfFee: feeRows.reduce((s, f) => s + f.mfFee, 0),
    totalToPay: feeRows.reduce((s, f) => s + f.totalToPay, 0),
  };

  async function handleSubmit() {
    if (!visits.length) return;
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
          visits: visits.map((v, i) => ({ ...v, ...feeRows[i] })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      setSavedReportId(id);
      setIsDirty(false);
      setVisits([]);
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
      {pendingWeek !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-amber-800 text-sm flex-1">
            Du har osparade ändringar — byt till vecka {pendingWeek} ändå?
          </span>
          <button
            onClick={() => applyWeekChange(pendingWeek)}
            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Byt ändå
          </button>
          <button
            onClick={() => setPendingWeek(null)}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Säsong</label>
              <select
                value={selectedSeasonId}
                onChange={e => {
                  setSelectedSeasonId(e.target.value);
                  setSavedReportId(null);
                  setVisits([]);
                  setIsDirty(false);
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {seasons.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.type === "VAR" ? "Vår" : "Höst"} {s.year}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vecka</label>
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
              <select
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
          {currentStatus === "DRAFT" && weekStatusMap.has(selectedWeek) && (
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg">
              Tidigare rapport laddad — lägg till eller redigera besök och spara igen
            </span>
          )}
        </div>

        {loadingVisits && (
          <div className="p-12 text-center text-slate-400 text-sm">Laddar tidigare rapport...</div>
        )}

        {loadError && (
          <div className="mx-4 md:mx-6 mt-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg">
            {loadError}
          </div>
        )}

        {!loadingVisits && visits.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm">
            Klicka &quot;Lägg till besök&quot; för att börja rapportera.
          </div>
        )}

        <div className={`divide-y divide-slate-100 ${isLocked ? "opacity-60 pointer-events-none select-none" : ""}`}>
          {visits.map((visit, i) => (
            <VisitRow
              key={i}
              index={i}
              visit={visit}
              customers={customers}
              feeRow={feeRows[i] ?? null}
              onUpdate={(field, value) => updateVisit(i, field, value)}
              onRemove={() => removeVisit(i)}
            />
          ))}
        </div>

        {!isLocked && (
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Total försäljning</p>
              <p className="font-bold text-slate-800">{formatSEK(totals.sales)}</p>
            </div>
            <div>
              <p className="text-slate-500">FT-avgift ex moms</p>
              <p className="font-bold text-slate-800">{formatSEK(totals.ftFee)}</p>
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
              disabled={saving || visits.length === 0}
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


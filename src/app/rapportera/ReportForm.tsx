"use client";

import { useState, useEffect, useRef } from "react";
import { calculateFees, formatSEK, type FeeConfig } from "@/lib/fees";
import type { Customer, Season } from "@prisma/client";

interface VisitRow {
  customerId: string;
  numberOfCustomers: number;
  sales: number;
  isFashionShow: boolean;
  fashionShowSales: number;
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
        // restore selected name if user blurred without picking
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
        <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">Ta bort</button>
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
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-fit">
          <input
            type="checkbox"
            id={`fashionshow-${index}`}
            checked={visit.isFashionShow}
            onChange={e => onUpdate("isFashionShow", e.target.checked)}
            className="rounded"
          />
          Modevisning
        </label>

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
          <span>MF-avgift: {formatSEK(feeRow.mfFee)}</span>
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
}

const customerTypeLabels: Record<string, string> = {
  VARDHEM: "Vårdhem",
  FORENING: "Förening",
  TRAFFPUNKT: "Träffpunkt",
  BOENDE_55: "Boende +55",
  OVRIGT: "Övrigt",
};

export default function ReportForm({
  customers,
  seasons,
  currentSeason,
  existingReports,
  districtId,
  feeConfig,
}: Props) {
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    currentSeason?.id ?? ""
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(() => {
    const week = new Date().getWeek();
    if (!currentSeason) return week;
    return Math.min(Math.max(week, currentSeason.weekStart), currentSeason.weekEnd);
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

  const currentReport = reports.find(r => r.week === selectedWeek) ?? null;
  const currentStatus = currentReport?.status ?? "DRAFT";
  const isLocked = currentStatus === "SUBMITTED" || currentStatus === "APPROVED";
  const isApproved = currentStatus === "APPROVED";

  useEffect(() => {
    fetch(
      `/api/reports/mf-accumulated?districtId=${districtId}&seasonId=${selectedSeasonId}&week=${selectedWeek}`
    )
      .then((r) => r.json())
      .then((d) => setMfAccumulated(d.accumulated ?? 0))
      .catch(() => {});
  }, [selectedSeasonId, selectedWeek, districtId]);

  // Load existing visits when switching to an already-reported week
  useEffect(() => {
    const isReported = reports.some(r => r.week === selectedWeek);
    if (!isReported) { setVisits([]); setLoadError(""); return; }
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
            comment: v.comment ?? "",
          })));
        }
      })
      .catch(() => { setLoadError("Kunde inte ladda rapporten. Försök igen."); })
      .finally(() => setLoadingVisits(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, selectedSeasonId, districtId]);

  function addVisit() {
    setVisits((v) => [
      ...v,
      {
        customerId: customers[0]?.id ?? "",
        numberOfCustomers: 0,
        sales: 0,
        isFashionShow: false,
        fashionShowSales: 0,
        comment: "",
      },
    ]);
  }

  function updateVisit(i: number, field: keyof VisitRow, value: unknown) {
    setVisits((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
  }

  function removeVisit(i: number) {
    setVisits((v) => v.filter((_, idx) => idx !== i));
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
      setVisits([]);
      // Uppdatera lokalt state utan prop-mutation
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
    const reportId = currentReport?.id ?? savedReportId;
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
      // Uppdatera lokalt state (immutable)
      setReports(prev => prev.map(r => r.week === selectedWeek ? { ...r, status: newStatus } : r));
      setSavedReportId(reportId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setLocking(false);
    }
  }

  const reportedWeeks = new Set(reports.map((r) => r.week));
  const weeks = currentSeason
    ? Array.from(
        { length: currentSeason.weekEnd - currentSeason.weekStart + 1 },
        (_, i) => i + currentSeason.weekStart
      )
    : Array.from({ length: 52 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-wrap gap-4 items-end">
          {seasons.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Säsong</label>
              <select
                value={selectedSeasonId}
                onChange={e => { setSelectedSeasonId(e.target.value); setSavedReportId(null); setVisits([]); }}
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Vecka
            </label>
            <select
              value={selectedWeek}
              onChange={(e) => {
                setSelectedWeek(Number(e.target.value));
                setSavedReportId(null);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {weeks.map((w) => (
                <option key={w} value={w}>
                  Vecka {w} {reportedWeeks.has(w) ? "✓" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-slate-500 pb-1">
            MF ackumulerat hittills:{" "}
            <span className="font-medium text-slate-700">
              {formatSEK(mfAccumulated)}
            </span>{" "}
            / {formatSEK(feeConfig.mfFeeCap)}
            {mfAccumulated >= feeConfig.mfFeeCap && (
              <span className="ml-2 text-amber-600 font-medium">
                (tak nått)
              </span>
            )}
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
          {currentStatus === "DRAFT" && reportedWeeks.has(selectedWeek) && (
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Total försäljning</p>
              <p className="font-bold text-slate-800">{formatSEK(totals.sales)}</p>
            </div>
            <div>
              <p className="text-slate-500">FT-avgift ex moms</p>
              <p className="font-bold text-slate-800">{formatSEK(totals.ftFee)}</p>
            </div>
            <div>
              <p className="text-slate-500">MF-avgift ex moms</p>
              <p className="font-bold text-slate-800">{formatSEK(totals.mfFee)}</p>
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
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-lg">
          {error}
        </p>
      )}

      {savedReportId && !isLocked && (
        <div className="flex items-center gap-4 bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
          <p className="text-green-700 text-sm font-medium flex-1">Rapporten sparades!</p>
          <a
            href={`/api/reports/${savedReportId}/export`}
            download
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
          >
            Ladda ner Excel
          </a>
        </div>
      )}

      {(visits.length > 0 || currentReport) && (
        <div className="flex flex-wrap gap-3 items-center">
          {/* Spara — dold när låst */}
          {!isLocked && (
            <button
              onClick={handleSubmit}
              disabled={saving || visits.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              {saving ? "Sparar..." : "Spara rapport"}
            </button>
          )}

          {/* Lås / Lås upp — ej tillgänglig om admin-godkänd */}
          {!isApproved && (currentReport || savedReportId) && (
            <button
              onClick={handleLockToggle}
              disabled={locking}
              className={`font-medium px-6 py-2.5 rounded-lg transition-colors ${
                currentStatus === "SUBMITTED"
                  ? "bg-amber-100 hover:bg-amber-200 text-amber-800"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {locking ? "..." : currentStatus === "SUBMITTED" ? "🔓 Lås upp rapport" : "🔒 Lås rapport"}
            </button>
          )}

          {/* Excel-länk när låst */}
          {isLocked && (currentReport?.id ?? savedReportId) && (
            <a
              href={`/api/reports/${currentReport?.id ?? savedReportId}/export`}
              download
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg"
            >
              Ladda ner Excel
            </a>
          )}
        </div>
      )}
    </div>
  );
}

declare global {
  interface Date {
    getWeek(): number;
  }
}

Date.prototype.getWeek = function () {
  const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

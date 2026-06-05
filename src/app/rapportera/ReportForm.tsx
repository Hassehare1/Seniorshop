"use client";

import { useState, useEffect } from "react";
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

interface Props {
  customers: Customer[];
  seasons: Season[];
  currentSeason: Season | null;
  existingReports: { week: number; status: string }[];
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
  currentSeason,
  existingReports,
  districtId,
  feeConfig,
}: Props) {
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    currentSeason?.id ?? ""
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(
    new Date().getWeek()
  );
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [mfAccumulated, setMfAccumulated] = useState(0);

  useEffect(() => {
    fetch(
      `/api/reports/mf-accumulated?districtId=${districtId}&seasonId=${selectedSeasonId}&week=${selectedWeek}`
    )
      .then((r) => r.json())
      .then((d) => setMfAccumulated(d.accumulated ?? 0))
      .catch(() => {});
  }, [selectedSeasonId, selectedWeek, districtId]);

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
      setSaved(true);
      setVisits([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Något gick fel");
    } finally {
      setSaving(false);
    }
  }

  const reportedWeeks = new Set(existingReports.map((r) => r.week));
  const weeks = Array.from({ length: 26 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Vecka
            </label>
            <select
              value={selectedWeek}
              onChange={(e) => {
                setSelectedWeek(Number(e.target.value));
                setSaved(false);
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

          <div className="flex items-end">
            <div className="text-sm text-slate-500">
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
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">Besök denna vecka</h2>
        </div>

        {visits.length === 0 && (
          <div className="p-12 text-center text-slate-400 text-sm">
            Klicka &quot;Lägg till besök&quot; för att börja rapportera.
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {visits.map((visit, i) => (
            <div key={i} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Besök {i + 1}
                </span>
                <button
                  onClick={() => removeVisit(i)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Ta bort
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Kund
                  </label>
                  <select
                    value={visit.customerId}
                    onChange={(e) => updateVisit(i, "customerId", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({customerTypeLabels[c.type]})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Antal kunder
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={visit.numberOfCustomers}
                    onChange={(e) =>
                      updateVisit(i, "numberOfCustomers", Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Försäljning (ink. moms)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={visit.sales}
                    onChange={(e) =>
                      updateVisit(i, "sales", Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visit.isFashionShow}
                    onChange={(e) =>
                      updateVisit(i, "isFashionShow", e.target.checked)
                    }
                    className="rounded"
                  />
                  Modevisning
                </label>

                {visit.isFashionShow && (
                  <div>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={visit.fashionShowSales}
                      placeholder="Försäljning modevisning"
                      onChange={(e) =>
                        updateVisit(i, "fashionShowSales", Number(e.target.value))
                      }
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <input
                  type="text"
                  value={visit.comment}
                  placeholder="Kommentar (valfritt)"
                  onChange={(e) => updateVisit(i, "comment", e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {feeRows[i] && (
                <div className="bg-slate-50 rounded-lg px-4 py-2 text-xs text-slate-500 flex gap-6">
                  <span>
                    FT-avgift: {formatSEK(feeRows[i].ftFee)}
                  </span>
                  <span>MF-avgift: {formatSEK(feeRows[i].mfFee)}</span>
                  <span className="font-medium text-slate-700">
                    Att betala: {formatSEK(feeRows[i].totalToPay)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-slate-100">
          <button
            onClick={addVisit}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Lägg till besök
          </button>
        </div>
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

      {saved && (
        <p className="text-green-600 text-sm bg-green-50 px-4 py-3 rounded-lg">
          Rapporten sparades!
        </p>
      )}

      {visits.length > 0 && (
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? "Sparar..." : "Spara rapport"}
          </button>
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

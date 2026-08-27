"use client";

import { useId } from "react";
import { customerTypeLabels as typeLabels } from "@/lib/customerTypes";
import { useFocusTrap } from "@/lib/useFocusTrap";

/** Granskningen som `api/admin/customers/merge` svarar med före bekräftelse. */
export type MergeSide = { id: string; name: string; label: string; type: string; visitCount: number };
export type MergePreview = {
  keep: MergeSide;
  remove: MergeSide;
  visitsToMove: number;
  typeDiffers: boolean;
  collisions: { seasonLabel: string; week: number; keepSales: number; removeSales: number }[];
};
export type MergeState = { keepId: string; removeId: string; preview: MergePreview | null; busy: boolean; error: string };

interface Props {
  merge: MergeState;
  onSelectKeep: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

// Sammanslagning av dubbletter: granskning innan något raderas. Uppstår vid
// inläsning när samma kund stavas olika i två filer.
export default function MergeDialog({ merge, onSelectKeep, onConfirm, onClose }: Props) {
  const uid = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>(true, () => { if (!merge.busy) onClose(); });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={() => !merge.busy && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-merge-title`}
        tabIndex={-1}
        className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto outline-none"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={`${uid}-merge-title`} className="text-lg font-semibold text-slate-800 mb-1">
          Slå ihop två kunder
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Välj vilken kund som ska behållas. Den andra raderas, och alla dess besök flyttas över.
        </p>

        {merge.busy && !merge.preview && (
          <p className="text-sm text-slate-400 py-6 text-center">Hämtar granskning...</p>
        )}

        {merge.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg mb-4">
            {merge.error}
          </p>
        )}

        {merge.preview && (
          <>
            {/* Valet: klicka på den kund som ska behållas */}
            {[merge.preview.keep, merge.preview.remove].map((c, i) => {
              const isKeep = i === 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={merge.busy}
                  onClick={() => !isKeep && onSelectKeep(c.id)}
                  className={`w-full text-left rounded-lg p-4 mb-2.5 flex items-start gap-3 transition ${
                    isKeep
                      ? "border-2 border-blue-600 bg-blue-50"
                      : "border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-[5px] ${
                      isKeep ? "border-blue-600 bg-white" : "border-slate-300 bg-white border"
                    }`}
                  />
                  <span className="flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${isKeep ? "text-slate-800" : "text-slate-600"}`}>
                        {c.name}
                      </span>
                      <span className="text-[11px] text-slate-400">{c.label}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                          isKeep ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {isKeep ? "Behålls" : "Raderas"}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500 mt-1">
                      {c.visitCount === 0 ? "Inga besök" : `${c.visitCount} besök`} · {typeLabels[c.type] ?? c.type}
                      {!isKeep && " · klicka för att behålla den här i stället"}
                    </span>
                  </span>
                </button>
              );
            })}

            {/* Namnbytet är retroaktivt och lätt att missa — samma sorts
                konsekvens som vid byte av kundtyp, och förklaras likadant. */}
            {merge.preview.visitsToMove > 0 && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold mb-1">Namnet skrivs om bakåt i tiden</p>
                <p>
                  {merge.preview.remove.name}s besök visas efteråt under namnet{" "}
                  <strong>{merge.preview.keep.name}</strong> — även i tidigare säsonger. Det syns i
                  Översikt, Försäljning, år-mot-år och exporter. Välj alltså det namn du vill känna
                  igen kunden på framåt.
                </p>
              </div>
            )}

            {merge.preview.typeDiffers && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mt-3">
                Kunderna har olika kundtyp. Den behållna kundens typ gäller efteråt, vilket flyttar
                försäljningen mellan staplarna i analysen.
              </p>
            )}

            {merge.preview.collisions.length > 0 ? (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 my-4">
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  Båda kunderna har besök samma vecka
                </p>
                <p className="text-[13px] text-amber-900/90 leading-relaxed mb-3">
                  En kund rapporteras en gång per vecka. Slås de ihop hamnar två besök på samma kund och
                  vecka, och då kan FT inte spara om veckan.
                </p>
                <div className="bg-white border border-amber-200 rounded-md px-3 py-2">
                  <p className="text-xs font-semibold text-amber-900 mb-1">
                    Krockar i {merge.preview.collisions.length}{" "}
                    {merge.preview.collisions.length === 1 ? "vecka" : "veckor"}:
                  </p>
                  <ul className="text-[13px] text-amber-900/90 space-y-0.5">
                    {merge.preview.collisions.map((k, i) => (
                      <li key={i}>
                        {k.seasonLabel} · v{k.week} — {k.keepSales.toLocaleString("sv-SE")} kr +{" "}
                        {k.removeSales.toLocaleString("sv-SE")} kr
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-[13px] text-amber-900/90 leading-relaxed mt-3">
                  Ta bort det ena besöket i respektive vecka först, eller slå ihop beloppen manuellt — kom
                  sedan tillbaka hit.
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 my-4">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Det här händer
                </p>
                <ul className="text-[13px] text-slate-700 space-y-1.5">
                  <li>
                    <strong>
                      {merge.preview.visitsToMove === 0
                        ? "Inga besök"
                        : `${merge.preview.visitsToMove} besök`}
                    </strong>{" "}
                    flyttas till {merge.preview.keep.name}
                  </li>
                  <li>Inga veckokrockar — kunderna har inga besök samma vecka</li>
                  <li>Avgifter och summor påverkas inte</li>
                  <li>{merge.preview.remove.name} raderas permanent</li>
                </ul>
              </div>
            )}

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Raderingen går inte att ångra. Händelseloggen sparar namn, kundnummer och antal flyttade
              besök.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={merge.busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={merge.busy || merge.preview.collisions.length > 0}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500"
              >
                {merge.busy ? "Slår ihop..." : `Slå ihop och radera ${merge.preview.remove.name}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

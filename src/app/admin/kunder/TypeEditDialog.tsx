"use client";

import { useId } from "react";
import { customerTypeOptions } from "@/lib/customerTypes";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { Customer } from "./AdminKunderClient";

interface Props {
  customer: Customer;
  valdTyp: string;
  working: boolean;
  onChangeValdTyp: (type: string) => void;
  onSave: () => void;
  onClose: () => void;
}

// Kundtypsbyte sker via en dialog, inte direkt i tabellen — konsekvensen är
// retroaktiv och behöver förklaras innan den sker.
export default function TypeEditDialog({ customer, valdTyp, working, onChangeValdTyp, onSave, onClose }: Props) {
  const uid = useId();
  // Fokusfälla + Escape — se lib/useFocusTrap.
  const dialogRef = useFocusTrap<HTMLDivElement>(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-typeedit-title`}
        tabIndex={-1}
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 outline-none"
        onClick={e => e.stopPropagation()}
      >
        <h2 id={`${uid}-typeedit-title`} className="text-lg font-bold text-slate-800">Ändra kundtyp</h2>
        <p className="text-sm text-slate-500 mt-0.5">{customer.name}</p>

        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">Ändringen gäller bakåt i tiden</p>
          <p>
            Kundtypen är inte kopplad till en tidpunkt. Byter du typ flyttas{" "}
            <strong>alla</strong> besök hos kunden — även tidigare säsonger — till den nya
            kategorin i statistiken. Summorna påverkas inte, bara fördelningen mellan
            kundtyper. Det syns i Översikt, Försäljning, år-mot-år och exporter.
          </p>
          <p className="mt-2">
            Har platsen två verksamheter ska den läggas upp som{" "}
            <strong>två kunder</strong> — inte som en kund som byter typ.
          </p>
        </div>

        <label className="block text-xs font-medium text-slate-600 mt-4 mb-1" htmlFor={`${uid}-ny-typ`}>Ny typ</label>
        <select id={`${uid}-ny-typ`}
          value={valdTyp}
          onChange={e => onChangeValdTyp(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {customerTypeOptions.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onSave}
            disabled={working || valdTyp === customer.type}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {working ? "Sparar…" : "Ändra kundtyp"}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useId } from "react";
import { formatSEK, type MoneyInput } from "@/lib/fees";
import { customerTypeLabels } from "@/lib/customerTypes";
import type { Customer } from "@prisma/client";

export interface VisitRowData {
  _key: string;
  customerId: string;
  numberOfCustomers: number;
  sales: number;
  isFashionShow: boolean;
  isHangerShow: boolean;
  isSale: boolean;
  comment: string;
}

// Visar om raden redan ligger sparad i databasen, är ändrad sedan sparningen,
// eller är ny och osparad. Utan detta ser sparade och osparade besök likadana
// ut, vilket gör det lätt att rapportera samma kund två gånger.
export type VisitStatus = "saved" | "changed" | "new";

function StatusChip({ status }: { status: VisitStatus }) {
  const style =
    status === "saved" ? "bg-green-100 text-green-700"
      : status === "changed" ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-500";
  const label = status === "saved" ? "Sparad" : status === "changed" ? "Ändrad" : "Ny";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

interface VisitRowProps {
  index: number;
  visit: VisitRowData;
  customers: Customer[];
  feeRow: { ftFee: MoneyInput; mfFee: MoneyInput; totalToPay: MoneyInput } | null;
  status: VisitStatus;
  // Kunder som redan ligger på veckan (i andra rader) — går inte att välja igen.
  takenCustomerIds: Set<string>;
  onUpdate: (field: keyof VisitRowData, value: unknown) => void;
  onRemove: () => void;
}

export default function VisitRow({ index, visit, customers, feeRow, status, takenCustomerIds, onUpdate, onRemove }: VisitRowProps) {
  const uid = useId();
  // Fältets sökterm hålls separat från vad som faktiskt är valt (visit.customerId)
  // — den betyder bara något medan open är sant. Stängt visas alltid den riktiga
  // valda kundens namn, härlett direkt i stället för synkat via en effekt. Det
  // löser buggen där Tab ur fältet lämnade sökrutan tom: den gamla varianten
  // återställde bara vid musklick utanför, aldrig vid tangentbordsnavigering.
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedName = customers.find(c => c.id === visit.customerId)?.name ?? "";
  const inputValue = open ? searchTerm : selectedName;

  const filtered = searchTerm === ""
    ? customers
    : customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerTypeLabels[c.type]?.toLowerCase().includes(searchTerm.toLowerCase())
      );

  useEffect(() => {
    if (highlighted >= 0) optionRefs.current[highlighted]?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function selectCustomer(id: string, name: string) {
    onUpdate("customerId", id);
    setSearchTerm(name);
    setOpen(false);
  }

  // Piltangenterna hoppar över redan rapporterade kunder (taken) i stället för
  // att låta dem gå att markera men inte välja.
  function moveHighlight(dir: 1 | -1) {
    if (filtered.length === 0) return;
    let i = highlighted;
    for (let steg = 0; steg < filtered.length; steg++) {
      i = (i + dir + filtered.length) % filtered.length;
      if (!takenCustomerIds.has(filtered[i].id)) { setHighlighted(i); return; }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      const valt = highlighted >= 0 ? filtered[highlighted] : undefined;
      if (open && valt && !takenCustomerIds.has(valt.id)) {
        e.preventDefault();
        selectCustomer(valt.id, valt.name);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Besök {index + 1}</span>
          <StatusChip status={status} />
        </div>
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
        <div className="col-span-2 lg:col-span-2 relative">
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-kund`}>Kund</label>
          <input id={`${uid}-kund`}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${uid}-listbox`}
            aria-autocomplete="list"
            aria-activedescendant={open && highlighted >= 0 ? `${uid}-opt-${filtered[highlighted].id}` : undefined}
            value={inputValue}
            placeholder="Sök kund..."
            onFocus={() => { setSearchTerm(""); setOpen(true); setHighlighted(-1); }}
            onChange={e => { setSearchTerm(e.target.value); setOpen(true); setHighlighted(-1); }}
            onKeyDown={handleKeyDown}
            onBlur={() => setOpen(false)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {open && (
            <div id={`${uid}-listbox`} role="listbox" className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-400">Inga kunder hittades</p>
              )}
              {filtered.map((c, i) => {
                // En kund rapporteras en gång per vecka — ligger den redan på en
                // annan rad går den inte att välja, då redigerar man den raden.
                const taken = takenCustomerIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    ref={el => { optionRefs.current[i] = el; }}
                    id={`${uid}-opt-${c.id}`}
                    role="option"
                    aria-selected={i === highlighted}
                    // Väljs via piltangenter + Enter på fältet ovan, inte genom att
                    // tabba till varje rad — annars måste tangentbordsanvändare
                    // klicka sig igenom hela kundlistan för att nå nästa fält.
                    tabIndex={-1}
                    type="button"
                    disabled={taken}
                    title={taken ? "Redan rapporterad denna vecka — redigera den befintliga raden" : undefined}
                    onMouseEnter={() => setHighlighted(i)}
                    onMouseDown={() => { if (!taken) selectCustomer(c.id, c.name); }}
                    className={`w-full text-left px-3 py-2 text-sm flex justify-between items-center gap-2 ${
                      taken
                        ? "bg-amber-50 text-slate-400 cursor-not-allowed"
                        : i === highlighted
                          ? "bg-blue-100 text-blue-700"
                          : c.id === visit.customerId
                            ? "bg-blue-50 text-blue-700 font-medium hover:bg-blue-50"
                            : "text-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    <span className="truncate min-w-0">{c.name}</span>
                    {taken ? (
                      <span className="text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                        Redan rapporterad
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">{customerTypeLabels[c.type]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-antal-kunder`}>Antal kunder</label>
          <input id={`${uid}-antal-kunder`}
            type="number"
            min={0}
            value={visit.numberOfCustomers === 0 ? "" : visit.numberOfCustomers}
            placeholder="0"
            onChange={e => onUpdate("numberOfCustomers", e.target.value === "" ? 0 : Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-forsaljning-ink-moms`}>Försäljning (ink. moms)</label>
          <input id={`${uid}-forsaljning-ink-moms`}
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
        {/* Antingen-eller: ett besök kan inte vara både modevisning och galge.
            Kryssar man i det ena bockas det andra ur automatiskt. */}
        <div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={visit.isFashionShow}
                onChange={e => {
                  onUpdate("isFashionShow", e.target.checked);
                  if (e.target.checked) onUpdate("isHangerShow", false);
                }}
                className="rounded"
              />
              Modevisning
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={visit.isHangerShow}
                onChange={e => {
                  onUpdate("isHangerShow", e.target.checked);
                  if (e.target.checked) onUpdate("isFashionShow", false);
                }}
                className="rounded"
              />
              Visning på galge
            </label>
          </div>
          <p className="text-xs text-slate-400 mt-1">Ett besök räknas antingen som modevisning eller galge — inte båda.</p>
        </div>

        {/* REA är en egen fråga, inte en tredje visningstyp: ett reabesök kan
            vara antingen modevisning eller galge. */}
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={visit.isSale}
              onChange={e => onUpdate("isSale", e.target.checked)}
              className="rounded"
            />
            REA-besök
          </label>
          <p className="text-xs text-slate-400 mt-1">Kryssa i när besöket är ett reabesök — de redovisas för sig i försäljningsvyn.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-kommentar`}>Kommentar</label>
          <textarea id={`${uid}-kommentar`}
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
          <span className="font-medium text-slate-700">Att betala: {formatSEK(feeRow.totalToPay)}</span>
        </div>
      )}
    </div>
  );
}

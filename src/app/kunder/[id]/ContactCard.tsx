"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPostalCode, postalCodeDigits, validatePostalCode } from "@/lib/postalCode";
import { materialSummary, parseAntal, validateVenue, VENUE_MAX_LENGTH } from "@/lib/salesMaterial";

type Values = {
  name: string;
  contactPerson: string;
  contactRole: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  venue: string;
  notes: string;
  postersA3: string;
  postersA4: string;
  digitalMaterial: boolean;
  digitalMaterialNote: string;
};

export default function ContactCard({
  customerId,
  initial,
  region,
}: {
  customerId: string;
  initial: Values;
  region: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial); // sparat läge (visas)
  const [form, setForm] = useState<Values>(initial);      // redigeringsbuffert
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setForm(values);
    setError("");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError("");
  }

  async function save() {
    // Namnet är kundens identitet i listor och rapporter — det får inte tömmas.
    // (Kundnumret består oavsett, men en namnlös rad går inte att hitta.)
    if (!form.name.trim()) {
      setError("Namnet kan inte vara tomt.");
      return;
    }

    const venueError = validateVenue(form.venue);
    if (venueError) {
      setError(venueError);
      return;
    }

    // Fånga fel format innan anropet — samma regel gäller på servern.
    const postalCodeError = validatePostalCode(form.postalCode, region);
    if (postalCodeError) {
      setError(postalCodeError);
      return;
    }

    setSaving(true);
    setError("");
    const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setValues(form);
      setEditing(false);
      // Rubriken högst upp på sidan renderas på servern — utan detta står det
      // gamla namnet kvar där tills sidan laddas om.
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Något gick fel vid sparning." }));
      setError(error ?? "Något gick fel vid sparning.");
    }
    setSaving(false);
  }

  const telHref = values.phone ? `tel:${values.phone.replace(/[^\d+]/g, "")}` : null;
  const mailHref = values.email ? `mailto:${values.email}` : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Kontaktuppgifter</h2>
        {!editing ? (
          <button
            onClick={startEdit}
            className="print:hidden bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Ändra uppgifter
          </button>
        ) : (
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={cancel}
              disabled={saving}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
            >
              Avbryt
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? "Sparar…" : "Spara"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <EditField label="Namn">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={input} placeholder="t.ex. Träffpunkt Centrum" />
            </EditField>
          </div>
          <EditField label="Kontaktperson">
            <input type="text" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} className={input} placeholder="Förnamn Efternamn" />
          </EditField>
          <EditField label="Kontaktroll">
            <input type="text" value={form.contactRole} onChange={e => setForm(f => ({ ...f, contactRole: e.target.value }))} className={input} placeholder="t.ex. Aktivitetsansvarig" />
          </EditField>
          <EditField label="Telefon">
            <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={input} placeholder="070-000 00 00" />
          </EditField>
          <EditField label="E-post">
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={input} placeholder="namn@exempel.se" />
          </EditField>
          <EditField label="Adress">
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={input} placeholder="Gatuadress, Ort" />
          </EditField>
          <EditField label="Postnummer">
            <input
              type="text"
              inputMode="numeric"
              value={form.postalCode}
              onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
              className={input}
              placeholder={postalCodeDigits(region) === 4 ? "1234" : "123 45"}
            />
          </EditField>
          <EditField label="Postort">
            <input
              type="text"
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="t.ex. Gärsnäs"
            />
          </EditField>
          <div className="sm:col-span-2">
            <EditField label="Möteslokal">
              <input type="text" value={form.venue} maxLength={VENUE_MAX_LENGTH}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                className={input} placeholder="T.ex. Kuben — om besöket är någon annanstans än på adressen" />
            </EditField>
          </div>

          {/* Säljmaterial — antal styr; noll betyder att formatet inte skickas. */}
          <div className="sm:col-span-2 border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Säljmaterial</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <EditField label="Affischer A3">
                <input type="number" min={0} inputMode="numeric" value={form.postersA3}
                  onChange={e => setForm(f => ({ ...f, postersA3: e.target.value }))} className={input} placeholder="0" />
              </EditField>
              <EditField label="Affischer A4">
                <input type="number" min={0} inputMode="numeric" value={form.postersA4}
                  onChange={e => setForm(f => ({ ...f, postersA4: e.target.value }))} className={input} placeholder="0" />
              </EditField>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-4 cursor-pointer w-fit">
              <input type="checkbox" checked={form.digitalMaterial}
                onChange={e => setForm(f => ({ ...f, digitalMaterial: e.target.checked }))} className="rounded" />
              Digitalt material
            </label>
            {form.digitalMaterial && (
              <input type="text" value={form.digitalMaterialNote}
                onChange={e => setForm(f => ({ ...f, digitalMaterialNote: e.target.value }))}
                className={`${input} mt-2`} placeholder="Vad skickas digitalt? T.ex. PDF prislista" />
            )}
            <p className="text-xs text-slate-400 mt-2">Tomt antal betyder att inget skickas.</p>
          </div>

          <div className="sm:col-span-2">
            <EditField label="Kommentar">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={input} placeholder="Noteringar, öppettider, m.m." />
            </EditField>
          </div>


        </div>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Kontaktperson">
            {values.contactPerson || "–"}
            {values.contactRole && <span className="text-slate-400"> · {values.contactRole}</span>}
          </Field>
          <Field label="Telefon">
            {telHref ? <a href={telHref} className="text-blue-600 hover:text-blue-800 font-medium">{values.phone}</a> : "–"}
          </Field>
          <Field label="E-post">
            {mailHref ? <a href={mailHref} className="text-blue-600 hover:text-blue-800 font-medium break-all">{values.email}</a> : "–"}
          </Field>
          <Field label="Adress">{values.address || "–"}</Field>
          <Field label="Postnummer">{formatPostalCode(values.postalCode, region) || "–"}</Field>
          <Field label="Postort">{values.city || "–"}</Field>
          <Field label="Möteslokal">{values.venue || "–"}</Field>
          <Field label="Säljmaterial">{materialSummary({
            postersA3: parseAntal(values.postersA3),
            postersA4: parseAntal(values.postersA4),
            digitalMaterial: values.digitalMaterial,
            digitalMaterialNote: values.digitalMaterialNote,
          }) || "–"}</Field>
          <div className="sm:col-span-2">
            <Field label="Kommentar">{values.notes || "–"}</Field>
          </div>
        </dl>
      )}
    </div>
  );
}

const input = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-slate-700">{children}</dd>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // Etiketten omsluter fältet: children är godtycklig JSX, så implicit
    // koppling är enda sättet som fungerar för alla varianter.
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

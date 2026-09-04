"use client";

import { useId, type Dispatch, type SetStateAction } from "react";
import { customerTypeOptions } from "@/lib/customerTypes";
import { postalCodeDigits } from "@/lib/postalCode";
import { VENUE_MAX_LENGTH } from "@/lib/venue";

export type CustomerFormState = {
  name: string; type: string; contactPerson: string; contactRole: string; email: string;
  phone: string; address: string; postalCode: string; city: string; venue: string; notes: string;
  postersA3: string; postersA4: string; digitalMaterial: boolean; digitalMaterialNote: string;
};

export const emptyCustomerForm: CustomerFormState = {
  name: "", type: "TRAFFPUNKTER", contactPerson: "", contactRole: "", email: "",
  phone: "", address: "", postalCode: "", city: "", venue: "", notes: "",
  postersA3: "", postersA4: "", digitalMaterial: false, digitalMaterialNote: "",
};

interface Props {
  form: CustomerFormState;
  setForm: Dispatch<SetStateAction<CustomerFormState>>;
  region: string; // distriktets region — styr postnumrets längd
  saving: boolean;
  saveError: string;
  onSave: () => void;
  onCancel: () => void;
}

// Lägg till/redigera kund. Formulärets fält är alla "ostyrda" mot en enda
// setForm — samma mönster som föräldern använde innan uppdelningen.
export default function CustomerForm({ form, setForm, region, saving, saveError, onSave, onCancel }: Props) {
  const uid = useId();

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSave(); }}
      className="bg-white border border-slate-200 rounded-xl p-6"
    >
      <h3 className="font-semibold text-slate-700 mb-4">
        Lägg till kund
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-namn`}>Namn *</label>
          <input id={`${uid}-namn`}
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="t.ex. Träffpunkt Centrum"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-typ`}>Typ *</label>
          <select id={`${uid}-typ`}
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {customerTypeOptions.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-kontaktperson`}>Kontaktperson</label>
          <input id={`${uid}-kontaktperson`}
            type="text"
            value={form.contactPerson}
            onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Förnamn Efternamn"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-kontaktroll`}>Kontaktroll</label>
          <input id={`${uid}-kontaktroll`}
            type="text"
            value={form.contactRole}
            onChange={e => setForm(f => ({ ...f, contactRole: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="t.ex. Aktivitetsansvarig"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-telefon`}>Telefon</label>
          <input id={`${uid}-telefon`}
            type="text"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="070-000 00 00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-e-post`}>E-post</label>
          <input id={`${uid}-e-post`}
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="namn@exempel.se"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-adress`}>Adress</label>
          <input id={`${uid}-adress`}
            type="text"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Gatuadress, Ort"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-postnummer`}>Postnummer</label>
          <input id={`${uid}-postnummer`}
            type="text"
            inputMode="numeric"
            value={form.postalCode}
            onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={postalCodeDigits(region) === 4 ? "1234" : "123 45"}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-postort`}>Postort</label>
          <input id={`${uid}-postort`}
            type="text"
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="t.ex. Gärsnäs"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-moteslokal`}>Möteslokal</label>
          <input id={`${uid}-moteslokal`}
            type="text"
            value={form.venue}
            maxLength={VENUE_MAX_LENGTH}
            onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="T.ex. Kuben — om besöket är någon annanstans än på adressen"
          />
        </div>

        {/* Säljmaterial — antal styr, noll betyder att formatet inte skickas */}
        <div className="col-span-2 border-t border-slate-200 pt-4 mt-1">
          <p className="text-xs font-semibold text-slate-600 mb-2">Säljmaterial</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-a3`}>Affischer A3</label>
              <input id={`${uid}-a3`} type="number" min={0} inputMode="numeric"
                value={form.postersA3}
                onChange={e => setForm(f => ({ ...f, postersA3: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-a4`}>Affischer A4</label>
              <input id={`${uid}-a4`} type="number" min={0} inputMode="numeric"
                value={form.postersA4}
                onChange={e => setForm(f => ({ ...f, postersA4: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 mt-3 cursor-pointer w-fit">
            <input type="checkbox" checked={form.digitalMaterial}
              onChange={e => setForm(f => ({ ...f, digitalMaterial: e.target.checked }))} className="rounded" />
            Digitalt material
          </label>
          {form.digitalMaterial && (
            <input type="text" value={form.digitalMaterialNote}
              onChange={e => setForm(f => ({ ...f, digitalMaterialNote: e.target.value }))}
              className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Vad skickas digitalt? T.ex. PDF prislista"
            />
          )}
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`${uid}-kommentar`}>Kommentar</label>
          <textarea id={`${uid}-kommentar`}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Noteringar, öppettider, m.m."
          />
        </div>

      </div>
      {saveError && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>
      )}
      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={saving || !form.name}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {saving ? "Sparar..." : "Spara kund"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}

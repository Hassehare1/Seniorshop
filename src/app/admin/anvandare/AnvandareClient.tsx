"use client";

import { useState } from "react";
import PasswordInput from "@/components/ui/PasswordInput";

interface District {
  id: string;
  number: number;
  name: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  districtId: string | null;
  district: { number: number; name: string } | null;
}

interface Props {
  users: User[];
  districts: District[];
}

const emptyForm = { name: "", email: "", password: "", role: "FRANCHISEE", districtId: "" };

export default function AnvandareClient({ users: initial, districts }: Props) {
  const [users, setUsers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit(u: User) {
    setEditingId(u.id);
    setForm({ name: u.name ?? "", email: u.email, password: "", role: u.role, districtId: u.districtId ?? "" });
    setShowForm(false);
    setError("");
  }

  function cancel() {
    setEditingId(null);
    setShowForm(false);
    setForm(emptyForm);
    setError("");
  }

  async function handleSave() {
    if (!form.email) return;
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      districtId: form.districtId || null,
    };
    if (form.password) payload.password = form.password;

    const url = editingId ? `/api/admin/users/${editingId}` : "/api/admin/users";
    const method = editingId ? "PATCH" : "POST";

    if (!editingId && !form.password) {
      setError("Lösenord krävs för ny användare");
      setSaving(false);
      return;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const saved = await res.json();
      if (editingId) {
        setUsers(prev => prev.map(u => u.id === editingId ? saved : u));
      } else {
        setUsers(prev => [...prev, saved]);
      }
      cancel();
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Något gick fel" }));
      setError(msg ?? "Något gick fel");
    }

    setSaving(false);
  }

  const formOpen = showForm || editingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-slate-500 text-sm">{users.length} användare</p>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); setError(""); }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Ny användare
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={e => { e.preventDefault(); handleSave(); }}
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <h3 className="font-semibold text-slate-700 mb-4">
            {editingId ? "Redigera användare" : "Ny användare"}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Namn</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Förnamn Efternamn"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">E-post *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="namn@seniorshop.se"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {editingId ? "Nytt lösenord (lämna tomt = oförändrat)" : "Lösenord *"}
              </label>
              <PasswordInput
                value={form.password}
                onChange={v => setForm(f => ({ ...f, password: v }))}
                placeholder={editingId ? "Lämna tomt för oförändrat" : "Minst 6 tecken"}
                autoComplete="new-password"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Roll *</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="FRANCHISEE">Franchisetagare</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Distrikt</label>
              <select
                value={form.districtId}
                onChange={e => setForm(f => ({ ...f, districtId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">– Inget distrikt –</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>D{d.number} – {d.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Kunder tillhör distriktet. Om FT byter distrikt får hen automatiskt alla kunder i det nya distriktet.
              </p>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving || !form.email}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {saving ? "Sparar..." : editingId ? "Spara ändringar" : "Skapa användare"}
            </button>
            <button type="button" onClick={cancel} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
              Avbryt
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[540px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Namn</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-post</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Roll</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Distrikt</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.name ?? "–"}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${u.role === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {u.role === "ADMIN" ? "Admin" : "Franchisetagare"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {u.district ? `D${u.district.number} – ${u.district.name}` : "–"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEdit(u)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Redigera
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

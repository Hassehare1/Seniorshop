"use client";

import { useState } from "react";

export default function ProfilClient() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError("");
    setSuccess(false);
    if (form.newPassword !== form.confirmPassword) {
      setError("Det nya lösenordet matchar inte bekräftelsen");
      return;
    }
    if (form.newPassword.length < 6) {
      setError("Nytt lösenord måste vara minst 6 tecken");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/user/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    });
    if (res.ok) {
      setSuccess(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      const { error: msg } = await res.json().catch(() => ({ error: "Något gick fel" }));
      setError(msg);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-md">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-700 mb-4">Byt lösenord</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nuvarande lösenord</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nytt lösenord</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minst 6 tecken"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Bekräfta nytt lösenord</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        {success && <p className="text-green-600 text-sm mt-3">✓ Lösenordet har bytts</p>}

        <button
          onClick={handleSave}
          disabled={saving || !form.currentPassword || !form.newPassword}
          className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium px-5 py-2 rounded-lg"
        >
          {saving ? "Sparar..." : "Byt lösenord"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

export default function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const on = theme === "seniorshop";

  function toggle() {
    const next: Theme = on ? "blue" : "seniorshop";
    setTheme(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    // Färgen sätts i root layout (server component) — en refresh räcker för
    // att hämta om den, ingen full sidladdning och inget förlorat klientläge.
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 max-w-md">
      <h2 className="font-semibold text-slate-700 mb-1">Utseende</h2>
      <p className="text-slate-500 text-sm mb-4">Gäller bara den här enheten, inte kontot.</p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700">{on ? "Seniorshop" : "Blå (standard)"}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Byt till Seniorshops egna färger"
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
            on ? "bg-blue-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              on ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

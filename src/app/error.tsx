"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Syns i webbläsarkonsolen; server-fel loggas dessutom i Vercels loggar
    console.error("App-fel:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-xl font-bold text-slate-800">Något gick fel</h1>
        <p className="text-slate-500 text-sm mt-2">
          Ett oväntat fel inträffade. Försök igen — om det kvarstår, kontakta support.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 mt-2">Felkod: {error.digest}</p>
        )}
        <div className="mt-5 flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
          >
            Försök igen
          </button>
          <Link
            href="/dashboard"
            className="text-slate-500 hover:text-slate-700 text-sm font-medium px-5 py-2.5"
          >
            Till översikten
          </Link>
        </div>
      </div>
    </div>
  );
}

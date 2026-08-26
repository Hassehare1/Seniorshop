"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fokusfälla för modaler: fokuserar första fältet när dialogen öppnas,
 * håller Tab/Shift+Tab innanför den (annars läcker fokus ut till
 * bakgrundsinnehållet), och stänger på Escape.
 *
 * Samma mönster som redan fanns i Sidebar.tsx för mobil-drawern, men det
 * spreds aldrig till AdminKunderClients två dialoger (kundtyp-byte,
 * sammanslagning) — den ena hade bara halva ARIA-uppsättningen, ingen
 * hade en riktig fälla. Extraherad hit så nästa dialog inte återuppfinner
 * den för hand en tredje gång.
 *
 * OBS: elementet `ref` sätts på måste ha tabIndex={-1} — annars kan det
 * inte ta emot fokus när dialogen (som sammanslagningens) öppnas i ett
 * laddningsläge utan några fokuserbara fält alls.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean, onEscape: () => void) {
  const ref = useRef<T>(null);
  const onEscapeRef = useRef(onEscape);
  // Uppdateras efter render (inte under den) — annars klagar eslint på att
  // en ref muteras under render. Ingen deps-array = körs efter varje commit.
  useEffect(() => { onEscapeRef.current = onEscape; });

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    const focusables = () => Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    // Finns inget fokuserbart ännu (t.ex. "Hämtar granskning..." utan
    // fält) — fokusera dialogen själv i stället för att göra ingenting.
    (focusables()[0] ?? container)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onEscapeRef.current(); return; }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  return ref;
}

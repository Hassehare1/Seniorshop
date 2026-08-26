// Personligt utseendeval — sparas i en kaka (samma mönster som säsongsminnet
// i dashboard/page.tsx), inte i databasen. Gäller den här enheten, inte kontot.
export type Theme = "blue" | "seniorshop";
export const THEME_COOKIE = "seniorshop_theme";
export const DEFAULT_THEME: Theme = "blue";

export function isTheme(value: string | undefined): value is Theme {
  return value === "blue" || value === "seniorshop";
}

// Diagram (Recharts) tar en bokstavlig färgsträng, inte en CSS-variabel — de
// kan därför inte följa med [data-theme]-omkopplingen i globals.css automatiskt.
// Plommon #8B1C6D är seniorshop.se:s egen accentfärg (knappar, länkar),
// kontrollerad direkt mot sajten 2026-08-26 — samma roll som blue-600 har här.
export const THEME_ACCENT: Record<Theme, string> = {
  blue: "#1d4ed8",
  seniorshop: "#8B1C6D",
};

// Distriktsrankingens gradient, mörkast → ljusast — samma struktur som den
// gamla scaleBlue, bara i den andra paletten.
export const THEME_ACCENT_SCALE: Record<Theme, string[]> = {
  blue: ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"],
  seniorshop: ["#3b0c2f", "#6e1757", "#8b1c6d", "#be2796", "#dc56b8", "#eb9ed6"],
};

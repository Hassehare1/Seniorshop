import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { THEME_COOKIE, isTheme, DEFAULT_THEME } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SeniorShop Portal",
  description: "Franchiseportal för veckorapportering",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  // Läses server-side innan sidan skickas — sidan hinner aldrig visa fel
  // färg och sedan hoppa, till skillnad från ett byte i en klienteffekt.
  // Utan kaka gäller standardfärgen — den måste sättas som attribut, inte
  // utelämnas. CSS-basen är den blå paletten, så ett tomt data-theme hade gett
  // blått oavsett vad DEFAULT_THEME säger.
  const theme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME;

  return (
    <html lang="sv" data-theme={theme}>
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

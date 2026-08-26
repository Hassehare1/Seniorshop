import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { THEME_COOKIE, isTheme } from "@/lib/theme";

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
  const theme = isTheme(themeCookie) ? themeCookie : undefined;

  return (
    <html lang="sv" data-theme={theme}>
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

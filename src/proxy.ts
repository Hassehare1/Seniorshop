import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Content Security Policy med nonce.
 *
 * Nonce kräver att sidorna renderas dynamiskt. Det kostar oss ingenting:
 * varje sida anropar redan auth() och är därmed dynamisk. Enda undantaget är
 * rot-sidan, som bara omdirigerar.
 *
 * style-src-attr förtjänar en förklaring. Ett nonce tillåter <style>-taggar,
 * men INTE style-attribut på element. recharts och React sätter inline-stilar
 * på element hela tiden — diagrammen slutar fungera utan detta. Att tillåta
 * inline style-ATTRIBUT är betydligt mildare än att tillåta inline script:
 * det öppnar för viss CSS-baserad avlyssning, inte för kodkörning.
 *
 * I utvecklingsläge krävs 'unsafe-eval' (React bygger felstackar med eval) och
 * inline-stilar (Turbopack injicerar CSS). Produktionspolicyn är alltså
 * strängare än den man ser lokalt — testa skarpt läge med `next build && next start`.
 */
function bygg(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // Diagrammens inline-stilar. Se resonemanget ovan.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Portalen pratar bara med sig själv — inga externa anrop från webbläsaren.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // API-routes har egna auth-checks och svarar med JSON — ingen CSP behövs,
  // och de ska inte heller kosta en nonce-generering.
  if (pathname.startsWith("/api")) return NextResponse.next();

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = bygg(nonce);

  // Nonce måste nå renderingen via REQUEST-headern; Next plockar upp den och
  // sätter den på sina egna script- och style-taggar automatiskt.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const medCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  const fortsatt = () => medCsp(NextResponse.next({ request: { headers: requestHeaders } }));

  // Inloggningssidan — alltid tillåten
  if (pathname === "/login") return fortsatt();

  // Allt annat kräver inloggning
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return medCsp(NextResponse.redirect(loginUrl));
  }

  // Admin-routes: kräver ADMIN-roll
  if (pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    return medCsp(NextResponse.redirect(new URL("/dashboard", req.url)));
  }

  return fortsatt();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};

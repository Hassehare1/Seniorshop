import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Inloggningssidan — alltid tillåten
  if (pathname === "/login") return NextResponse.next();

  // API-routes har egna auth-checks — skippa proxy-skyddet
  if (pathname.startsWith("/api")) return NextResponse.next();

  // Allt annat kräver inloggning
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-routes: kräver ADMIN-roll
  if (pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

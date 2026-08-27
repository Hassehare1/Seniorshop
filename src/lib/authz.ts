import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";

// Behörighetskontroll för API-routes, samlad på ett ställe. Fanns tidigare
// kopierad för hand i ~25 routes (`if (!session?.user) ...` / `if
// (session?.user?.role !== "ADMIN") ...`) — funktionellt identisk överallt,
// men varje kopia var ett tillfälle att av misstag skriva `if (!session)`
// (se [[auth-grind-user]]: auth() kan ge ett felobjekt som släpper igenom
// alla om man bara kollar sessionen och inte session.user).
//
// Användning i en route:
//   const session = await requireSession();
//   if (session instanceof NextResponse) return session;
//   // session.user är garanterat satt här
export type AuthedSession = Session & { user: NonNullable<Session["user"]> };

export async function requireSession(): Promise<AuthedSession | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session as AuthedSession;
}

export async function requireAdmin(): Promise<AuthedSession | NextResponse> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session as AuthedSession;
}

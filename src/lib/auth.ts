import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Rate limiting för inloggning — bromsar lösenordsgissning
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minuter
const LOGIN_MAX_ATTEMPTS = 8; // max misslyckade försök per e-post inom fönstret

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-post", type: "email" },
        password: { label: "Lösenord", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email as string;

        // Spärr: för många misslyckade försök senaste 15 min
        const since = new Date(Date.now() - LOGIN_WINDOW_MS);
        const recentFailures = await prisma.auditLog.count({
          where: { action: "LOGIN_FAILED", userEmail: email, createdAt: { gte: since } },
        });
        if (recentFailures >= LOGIN_MAX_ATTEMPTS) {
          // Avslöja inte att kontot är spärrat — generiskt fel visas
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { district: true },
        });

        // Spärrat konto — neka utan att räkna som lösenordsfel
        if (user && !user.active) return null;

        const valid =
          user && (await bcrypt.compare(credentials.password as string, user.passwordHash));

        if (!user || !valid) {
          // Logga misslyckat försök (bromsas själv av spärren ovan)
          await prisma.auditLog.create({
            data: {
              action: "LOGIN_FAILED",
              entity: "User",
              entityId: user?.id ?? email,
              userEmail: email,
            },
          });
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          districtId: user.districtId,
          districtNumber: user.district?.number ?? null,
        };
      },
    }),
  ],
  callbacks: {
    // OBS: jwt-callbacken körs även i proxyn/middleware. Gör INGA DB-anrop här —
    // Prisma i middleware-kontext är instabilt på Vercel och orsakar sporadiska 500.
    // Kontospärr/rollbyten enforced vid inloggning (authorize) i stället.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.districtId = (user as any).districtId;
        token.districtNumber = (user as any).districtNumber;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.districtId = token.districtId as string | null;
      session.user.districtNumber = token.districtNumber as number | null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});

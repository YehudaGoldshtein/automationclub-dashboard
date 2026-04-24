import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";

import { db, users } from "@/lib/db";
import { log } from "@/lib/log";

declare module "next-auth" {
  interface User {
    role?: "admin" | "customer";
    customerId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      role: "admin" | "customer";
      customerId: string | null;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.toLowerCase().trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) {
          log.warn("login_bad_form", { email_present: !!email });
          return null;
        }

        const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!row) {
          log.warn("login_unknown_email", { email });
          return null;
        }

        const ok = await compare(password, row.passwordHash);
        if (!ok) {
          log.warn("login_bad_password", { email });
          return null;
        }

        log.info("login_ok", { email, role: row.role, customer_id: row.customerId });
        return {
          id: row.id,
          email: row.email,
          role: row.role as "admin" | "customer",
          customerId: row.customerId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.role = user.role as "admin" | "customer";
        token.customerId = (user.customerId ?? null) as string | null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "admin" | "customer";
      session.user.customerId = (token.customerId ?? null) as string | null;
      return session;
    },
  },
});

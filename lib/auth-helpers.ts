import { redirect } from "next/navigation";
import type { Session as NextAuthSession } from "next-auth";

import { auth } from "@/auth";

export type Session = NextAuthSession;

export async function requireSession(): Promise<Session> {
  const session = (await auth()) as Session | null;
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    redirect(session.user.customerId ? `/c/${session.user.customerId}` : "/login");
  }
  return session;
}

/**
 * Resolve which customer_id the caller is allowed to read.
 * - Admin: can scope to anything (returns the requested id or null if unscoped).
 * - Customer: hard-forced to their own customerId. Requesting any other id → redirect.
 *
 * This is the only place customer scoping decisions happen — every page/API that
 * reads tenant data goes through this.
 */
export async function resolveCustomerScope(requestedId: string | null): Promise<{
  customerId: string | null;
  isAdmin: boolean;
}> {
  const session = await requireSession();
  if (session.user.role === "admin") {
    return { customerId: requestedId, isAdmin: true };
  }
  if (!session.user.customerId) {
    redirect("/login");
  }
  if (requestedId && requestedId !== session.user.customerId) {
    redirect(`/c/${session.user.customerId}`);
  }
  return { customerId: session.user.customerId, isAdmin: false };
}

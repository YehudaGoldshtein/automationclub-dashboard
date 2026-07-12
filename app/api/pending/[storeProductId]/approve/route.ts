import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { requireSession, resolveCustomerScope } from "@/lib/auth-helpers";
import { log } from "@/lib/log";
import { db, storeProducts } from "@/lib/db";

/**
 * Approve a pending draft product for activation.
 *
 * Contract: this is a Neon write ONLY — the dashboard holds no Shopify token
 * and never calls Shopify. It flips `approved`/`approved_at` on the draft's
 * variant rows; the Python sync job later promotes approved drafts to active
 * in Shopify.
 *
 * Tenant scoping goes through resolveCustomerScope() — the customer_id comes
 * from the caller's session (a customer-role user is hard-forced to their own
 * tenant), never from a URL param.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ storeProductId: string }> },
) {
  const { storeProductId } = await ctx.params;
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const requestedId: string | null = body?.customerId ?? null;
  const scope = await resolveCustomerScope(requestedId);

  // Admins must target a specific customer; customers are auto-scoped.
  if (!scope.customerId) {
    return new NextResponse("customerId required", { status: 400 });
  }

  const updated = await db
    .update(storeProducts)
    .set({ approved: true, approvedAt: sql`now()` })
    .where(
      and(
        eq(storeProducts.customerId, scope.customerId),
        eq(storeProducts.storeProductId, storeProductId),
        eq(storeProducts.status, "draft"),
      ),
    )
    .returning({ sku: storeProducts.sku });

  log.info("pending_approve_ok", {
    email: session.user.email,
    customer_id: scope.customerId,
    store_product_id: storeProductId,
    variants_approved: updated.length,
  });

  return NextResponse.json({
    ok: true,
    customer_id: scope.customerId,
    store_product_id: storeProductId,
    variants_approved: updated.length,
  });
}

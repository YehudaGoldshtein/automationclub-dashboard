import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireSession, resolveCustomerScope } from "@/lib/auth-helpers";
import { log } from "@/lib/log";
import { db, storeProducts } from "@/lib/db";

/**
 * Ignore (reject) a pending draft product.
 *
 * Contract: Neon write ONLY — the dashboard holds no Shopify token and never
 * calls Shopify. Sets status='rejected' on the draft's variant rows so it
 * drops off the pending list immediately; the tokened sync/reconcile job
 * later deletes rejected products from Shopify.
 *
 * Tenant scoping goes through resolveCustomerScope() — customer_id comes from
 * the caller's session (a customer-role user is hard-forced to their own
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

  if (!scope.customerId) {
    return new NextResponse("customerId required", { status: 400 });
  }

  const updated = await db
    .update(storeProducts)
    .set({ status: "rejected" })
    .where(
      and(
        eq(storeProducts.customerId, scope.customerId),
        eq(storeProducts.storeProductId, storeProductId),
        eq(storeProducts.status, "draft"),
      ),
    )
    .returning({ sku: storeProducts.sku });

  log.info("pending_ignore_ok", {
    email: session.user.email,
    customer_id: scope.customerId,
    store_product_id: storeProductId,
    variants_rejected: updated.length,
  });

  return NextResponse.json({
    ok: true,
    customer_id: scope.customerId,
    store_product_id: storeProductId,
    variants_rejected: updated.length,
  });
}

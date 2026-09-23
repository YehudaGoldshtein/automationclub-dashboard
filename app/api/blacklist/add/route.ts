import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { requireSession, resolveCustomerScope } from "@/lib/auth-helpers";
import { log } from "@/lib/log";
import { db, storeProducts } from "@/lib/db";

/**
 * Manually blacklist products by SKU. Neon write ONLY — the dashboard holds no
 * Shopify token; the tokened reconcile job honors `blacklisted` on the next sync.
 *
 * Resolve-only: a SKU is blacklisted only if a store_products row already exists
 * for it (PK is customer_id + sku). Unknown SKUs are reported back in `unmatched`,
 * never inserted, so typos can't create junk rows. Per-SKU (not whole product):
 * blacklists exactly the matched variant row(s) and clears their
 * unarchive_candidate flag so they drop off the Unarchive tab. Scoped via
 * resolveCustomerScope; SKUs come from the request body, the tenant does not.
 */
export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const requestedId: string | null = body?.customerId ?? null;
  const skus: string[] = Array.isArray(body?.skus)
    ? body.skus
        .filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0)
        .map((s: string) => s.trim())
    : [];

  if (skus.length === 0) {
    return new NextResponse("skus required", { status: 400 });
  }

  const scope = await resolveCustomerScope(requestedId);
  if (!scope.customerId) {
    return new NextResponse("customerId required", { status: 400 });
  }

  const wanted = [...new Set(skus)];

  const updated = await db
    .update(storeProducts)
    .set({ blacklisted: true, unarchiveCandidate: false })
    .where(
      and(eq(storeProducts.customerId, scope.customerId), inArray(storeProducts.sku, wanted)),
    )
    .returning({ sku: storeProducts.sku });

  const matched = updated.map((r) => r.sku);
  const matchedSet = new Set(matched);
  const unmatched = wanted.filter((s) => !matchedSet.has(s));

  log.info("blacklist_add_ok", {
    email: session.user.email,
    customer_id: scope.customerId,
    requested: wanted.length,
    matched: matched.length,
    unmatched: unmatched.length,
  });

  return NextResponse.json({ ok: true, matched, unmatched });
}

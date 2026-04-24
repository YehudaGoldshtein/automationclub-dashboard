import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { requireSession } from "@/lib/auth-helpers";
import {
  customers,
  db,
  storeProducts,
  syncRunChanges,
  syncRunErrors,
  syncRuns,
  vendorSnapshotCache,
} from "@/lib/db";
import type { Customer } from "@/lib/types";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  const session = await requireSession();

  const [run] = await db
    .select({ runId: syncRuns.runId, customerId: syncRuns.customerId })
    .from(syncRuns)
    .where(eq(syncRuns.runId, runId))
    .limit(1);

  if (!run) return new NextResponse("not found", { status: 404 });

  if (session.user.role !== "admin" && run.customerId !== session.user.customerId) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const [customer] = await db
    .select({ configJson: customers.configJson })
    .from(customers)
    .where(eq(customers.id, run.customerId))
    .limit(1);
  const config: Customer | null = customer ? JSON.parse(customer.configJson) : null;
  const vendorNames = (config?.vendors ?? []).map((v) => v.name);
  const storeUrl = (config?.store.store_url ?? "").replace(/\/+$/, "");
  const myshopify = config?.store.myshopify_domain ?? null;

  const [changes, errors] = await Promise.all([
    db.select().from(syncRunChanges).where(eq(syncRunChanges.runId, runId)),
    db.select().from(syncRunErrors).where(eq(syncRunErrors.runId, runId)),
  ]);

  const skus = changes.map((c) => c.sku);
  const [vendorRows, storeRows] = await Promise.all([
    skus.length && vendorNames.length
      ? db
          .select()
          .from(vendorSnapshotCache)
          .where(
            and(
              inArray(vendorSnapshotCache.vendorName, vendorNames),
              inArray(vendorSnapshotCache.vendorProductId, skus),
            ),
          )
      : Promise.resolve([] as never[]),
    skus.length
      ? db
          .select()
          .from(storeProducts)
          .where(
            and(
              eq(storeProducts.customerId, run.customerId),
              inArray(storeProducts.sku, skus),
            ),
          )
      : Promise.resolve([] as never[]),
  ]);

  const vendorBySku = new Map<string, (typeof vendorRows)[number]>();
  for (const v of vendorRows) vendorBySku.set(v.vendorProductId, v);
  const storeBySku = new Map<string, (typeof storeRows)[number]>();
  for (const s of storeRows) storeBySku.set(s.sku, s);

  const isAdmin = session.user.role === "admin";

  return NextResponse.json({
    runId,
    customerId: run.customerId,
    changes: changes.map((c) => {
      const v = vendorBySku.get(c.sku);
      const s = storeBySku.get(c.sku);
      const storefrontUrl =
        s?.handle && storeUrl ? `${storeUrl}/products/${s.handle}` : null;
      const adminUrl =
        isAdmin && s?.storeProductId && myshopify
          ? `https://${myshopify}/admin/products/${s.storeProductId}`
          : null;
      return {
        id: c.id,
        sku: c.sku,
        kind: c.kind,
        newStock: c.newStock,
        reason: c.reason,
        applied: c.applied,
        vendor: v
          ? {
              name: v.name,
              imageUrl: v.imageUrl,
              price: v.price,
              currency: v.currency,
              vendorName: v.vendorName,
              isAvailable: v.isAvailable,
            }
          : null,
        store: s
          ? {
              title: s.title,
              handle: s.handle,
              storefrontUrl,
              adminUrl,
            }
          : null,
      };
    }),
    errors,
  });
}

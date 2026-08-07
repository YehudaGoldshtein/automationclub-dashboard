import { NextResponse } from "next/server";
import { request } from "@octokit/request";

import { requireSession } from "@/lib/auth-helpers";
import { log } from "@/lib/log";

/**
 * Kicks off backend ingestion of an already-uploaded inventory spreadsheet.
 * The client uploads the raw file to Vercel Blob (see /api/inventory/upload),
 * then calls this with the resulting blob URL. We authorize the caller and
 * dispatch a GitHub Actions workflow that pulls the blob and digests it into
 * the shared Neon DB — the dashboard itself writes nothing.
 */
export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const requestedId: string | undefined = body?.customerId;
  const blobUrl: string | undefined = body?.blobUrl;
  const runRef: string | undefined = body?.runRef;

  if (!blobUrl) {
    return new NextResponse("blobUrl required", { status: 400 });
  }

  // Customers can only ingest into their own inventory.
  if (session.user.role !== "admin") {
    if (!session.user.customerId || requestedId !== session.user.customerId) {
      log.warn("inventory_trigger_forbidden", {
        email: session.user.email,
        requested: requestedId ?? null,
        own: session.user.customerId,
      });
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.SYNC_WORKFLOW_OWNER || "YehudaGoldshtein";
  const repo = process.env.SYNC_WORKFLOW_REPO || "AutomationClub";
  const workflow = process.env.INVENTORY_WORKFLOW_FILE || "inventory-ingest.yml";
  if (!token) {
    log.error("inventory_trigger_no_token");
    return new NextResponse("GITHUB_TOKEN not configured", { status: 503 });
  }

  try {
    await request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
      owner,
      repo,
      workflow_id: workflow,
      ref: "main",
      inputs: {
        blob_url: blobUrl,
        customer_id: requestedId ?? "",
        dry_run: "false",
        // Tracking key the backend writes into ingest_runs; optional server-side.
        ...(runRef ? { run_ref: runRef } : {}),
      },
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("inventory_trigger_dispatch_failed", {
      email: session.user.email,
      customer_id: requestedId ?? null,
      error: message,
    });
    return new NextResponse(`dispatch failed: ${message}`, { status: 502 });
  }

  log.info("inventory_trigger_ok", {
    email: session.user.email,
    customer_id: requestedId ?? null,
    workflow: `${owner}/${repo}/${workflow}`,
    blob_url: blobUrl,
    run_ref: runRef ?? null,
  });
  return NextResponse.json({
    ok: true,
    triggered_by: session.user.email,
    customer_id: requestedId ?? null,
    run_ref: runRef ?? null,
  });
}

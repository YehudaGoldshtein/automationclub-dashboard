import { NextResponse } from "next/server";
import { request } from "@octokit/request";

import { requireSession } from "@/lib/auth-helpers";
import { log } from "@/lib/log";

export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const requestedId: string | undefined = body?.customerId;

  // Customers can only trigger their own sync.
  if (session.user.role !== "admin") {
    if (!session.user.customerId || requestedId !== session.user.customerId) {
      log.warn("trigger_sync_forbidden", {
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
  const workflow = process.env.SYNC_WORKFLOW_FILE || "sync.yml";
  if (!token) {
    log.error("trigger_sync_no_token");
    return new NextResponse("GITHUB_TOKEN not configured", { status: 503 });
  }

  try {
    await request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
      owner,
      repo,
      workflow_id: workflow,
      ref: "main",
      inputs: { dry_run: "false" },
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("trigger_sync_dispatch_failed", {
      email: session.user.email,
      customer_id: requestedId ?? null,
      error: message,
    });
    return new NextResponse(`dispatch failed: ${message}`, { status: 502 });
  }

  log.info("trigger_sync_ok", {
    email: session.user.email,
    customer_id: requestedId ?? null,
    workflow: `${owner}/${repo}/${workflow}`,
  });
  return NextResponse.json({
    ok: true,
    triggered_by: session.user.email,
    customer_id: requestedId ?? null,
  });
}

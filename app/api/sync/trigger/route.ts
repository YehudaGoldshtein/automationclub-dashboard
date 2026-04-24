import { NextResponse } from "next/server";
import { request } from "@octokit/request";

import { requireSession } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  const session = await requireSession();

  const body = await req.json().catch(() => ({}));
  const requestedId: string | undefined = body?.customerId;

  // Customers can only trigger their own sync.
  if (session.user.role !== "admin") {
    if (!session.user.customerId || requestedId !== session.user.customerId) {
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.SYNC_WORKFLOW_OWNER || "YehudaGoldshtein";
  const repo = process.env.SYNC_WORKFLOW_REPO || "AutomationClub";
  const workflow = process.env.SYNC_WORKFLOW_FILE || "sync.yml";
  if (!token) {
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
    return new NextResponse(`dispatch failed: ${message}`, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    triggered_by: session.user.email,
    customer_id: requestedId ?? null,
  });
}

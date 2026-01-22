import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Octokit } from "octokit";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const accessToken = (session as { accessToken?: string }).accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "GitHub token not available" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json({ error: "Owner and repo required" }, { status: 400 });
    }

    const octokit = new Octokit({ auth: accessToken });

    // Fetch recent PRs created by the user (or vibe branches)
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all", // open, closed, all
      sort: "created",
      direction: "desc",
      per_page: 10,
    });

    // Filter to show vibe branches or user's PRs
    const userName = session.user?.name || "";
    const relevantPRs = prs.filter(pr =>
      pr.head.ref.startsWith("vibe/") ||
      pr.user?.login === userName
    ).slice(0, 5);

    const formattedPRs = relevantPRs.map(pr => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      branch: pr.head.ref,
      state: pr.state,
      merged: pr.merged_at !== null,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));

    return NextResponse.json({ prs: formattedPRs });
  } catch (error) {
    console.error("Fetch recent PRs error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to fetch PRs",
    }, { status: 500 });
  }
}

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

    // Fetch branches
    const { data: branches } = await octokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 30,
    });

    // Fetch recent commits from default branch
    const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoInfo.default_branch;

    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: defaultBranch,
      per_page: 10,
    });

    const formattedBranches = branches.map(b => ({
      name: b.name,
      isDefault: b.name === defaultBranch,
      isProtected: b.protected,
      isVibe: b.name.startsWith("vibe/"),
    }));

    // Sort: default first, then vibe branches, then others
    formattedBranches.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      if (a.isVibe && !b.isVibe) return -1;
      if (!a.isVibe && b.isVibe) return 1;
      return a.name.localeCompare(b.name);
    });

    const formattedCommits = commits.map(c => ({
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit.message.split("\n")[0], // First line only
      author: c.commit.author?.name || c.author?.login || "Unknown",
      date: c.commit.author?.date || "",
      url: c.html_url,
    }));

    return NextResponse.json({
      branches: formattedBranches,
      commits: formattedCommits,
      defaultBranch,
    });
  } catch (error) {
    console.error("Fetch branches error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to fetch branches",
    }, { status: 500 });
  }
}

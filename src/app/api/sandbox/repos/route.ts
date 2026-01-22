import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserRepos, touchRepo, getRepoByName } from "@/db/helpers";
import { access } from "fs/promises";
import path from "path";

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

// GET - List user's cloned repos
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      // Return empty repos instead of 401 - user may not have any cloned repos yet
      return NextResponse.json({ repos: [] });
    }

    const dbRepos = getUserRepos(user.id);

    // Check which repos actually exist on disk
    const repos = [];
    for (const repo of dbRepos) {
      const repoPath = path.join(WORKSPACE_PATH, repo.name);
      try {
        await access(path.join(repoPath, ".git"));
        repos.push({
          id: repo.id,
          name: repo.name,
          owner: repo.owner,
          fullName: repo.fullName,
          defaultBranch: repo.defaultBranch,
          lastUsedAt: repo.lastUsedAt?.toISOString() || null,
        });
      } catch {
        // Repo not on disk, skip (could clean up DB here)
      }
    }

    // Sort by last used
    repos.sort((a, b) => {
      if (!a.lastUsedAt && !b.lastUsedAt) return 0;
      if (!a.lastUsedAt) return 1;
      if (!b.lastUsedAt) return -1;
      return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
    });

    return NextResponse.json({ repos });
  } catch (error) {
    console.error("Get repos error:", error);
    return NextResponse.json({ repos: [] });
  }
}

// POST - Mark repo as used
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { repoName, markUsed } = await request.json();

    if (!repoName) {
      return NextResponse.json({ error: "Repo name required" }, { status: 400 });
    }

    if (markUsed) {
      const repo = getRepoByName(user.id, repoName);
      if (repo) {
        touchRepo(repo.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update repo error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to update repo",
    }, { status: 500 });
  }
}

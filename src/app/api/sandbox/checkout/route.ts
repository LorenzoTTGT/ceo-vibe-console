import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSafeRepoPath, safeGit, validateBranchName, validateCommitSha } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { repoName, branch, commit } = await request.json();

    if (!repoName) {
      return NextResponse.json({ error: "Repository name required" }, { status: 400 });
    }

    const repoPath = getSafeRepoPath(repoName);
    if (!repoPath) {
      return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
    }

    if (!branch && !commit) {
      return NextResponse.json({ error: "Branch or commit required" }, { status: 400 });
    }

    if (branch && !validateBranchName(branch)) {
      return NextResponse.json({ error: "Invalid branch name" }, { status: 400 });
    }

    if (commit && !validateCommitSha(commit)) {
      return NextResponse.json({ error: "Invalid commit SHA" }, { status: 400 });
    }

    try {
      // Fetch latest from origin first
      await safeGit(repoPath, ["fetch", "origin"], { timeout: 30000 });

      // Stash any local changes
      await safeGit(repoPath, ["stash"], { timeout: 10000 }).catch(() => {});

      // Checkout the target branch/commit
      if (branch) {
        // Try to checkout existing branch, or create from origin
        try {
          await safeGit(repoPath, ["checkout", branch], { timeout: 10000 });
        } catch {
          // Branch doesn't exist locally, try from origin
          await safeGit(repoPath, ["checkout", "-b", branch, `origin/${branch}`], { timeout: 10000 });
        }
        // Pull latest
        await safeGit(repoPath, ["pull", "origin", branch], { timeout: 30000 }).catch(() => {});
      } else if (commit) {
        // Checkout specific commit (detached HEAD)
        await safeGit(repoPath, ["checkout", commit], { timeout: 10000 });
      }

      // Get current branch/commit info
      const { stdout: currentBranch } = await safeGit(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"], { timeout: 5000 });
      const { stdout: currentCommit } = await safeGit(repoPath, ["rev-parse", "--short", "HEAD"], { timeout: 5000 });
      const { stdout: commitMessage } = await safeGit(repoPath, ["log", "-1", "--pretty=%s"], { timeout: 5000 });

      return NextResponse.json({
        success: true,
        currentBranch: currentBranch.trim(),
        currentCommit: currentCommit.trim(),
        commitMessage: commitMessage.trim(),
      });
    } catch (gitError) {
      console.error("Git checkout error:", gitError);
      return NextResponse.json({
        success: false,
        error: `Checkout failed: ${gitError instanceof Error ? gitError.message : "Unknown error"}`,
      });
    }
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to checkout",
    }, { status: 500 });
  }
}

// GET current branch info
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repoName = searchParams.get("repo");

    if (!repoName) {
      return NextResponse.json({ error: "Repository name required" }, { status: 400 });
    }

    const repoPath = getSafeRepoPath(repoName);
    if (!repoPath) {
      return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
    }

    try {
      const { stdout: currentBranch } = await safeGit(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"], { timeout: 5000 });
      const { stdout: currentCommit } = await safeGit(repoPath, ["rev-parse", "--short", "HEAD"], { timeout: 5000 });
      const { stdout: commitMessage } = await safeGit(repoPath, ["log", "-1", "--pretty=%s"], { timeout: 5000 });

      // Check if there are uncommitted changes
      const { stdout: status } = await safeGit(repoPath, ["status", "--porcelain"], { timeout: 5000 });
      const hasChanges = status.trim().length > 0;

      return NextResponse.json({
        currentBranch: currentBranch.trim(),
        currentCommit: currentCommit.trim(),
        commitMessage: commitMessage.trim(),
        hasChanges,
      });
    } catch (gitError) {
      console.error("Git status error:", gitError);
      return NextResponse.json({
        error: `Failed to get branch info: ${gitError instanceof Error ? gitError.message : "Unknown error"}`,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Get branch error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to get branch info",
    }, { status: 500 });
  }
}

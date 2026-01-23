import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSafeRepoPath, safeGit } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");

    if (!repo) {
      return NextResponse.json({
        branch: null,
        hasChanges: false,
        changedFiles: [],
      });
    }

    const repoPath = getSafeRepoPath(repo);
    if (!repoPath) {
      return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
    }

    // Get git status
    const { stdout: statusOutput } = await safeGit(repoPath, ["status", "--porcelain"], { timeout: 10000 });

    // Get current branch
    const { stdout: branchOutput } = await safeGit(repoPath, ["branch", "--show-current"], { timeout: 10000 });

    // Parse changed files
    const changedFiles = statusOutput
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const status = line.substring(0, 2).trim();
        const file = line.substring(3);
        return { status, file };
      });

    return NextResponse.json({
      branch: branchOutput.trim(),
      hasChanges: changedFiles.length > 0,
      changedFiles,
    });
  } catch (error) {
    console.error("Status error:", error);
    return NextResponse.json({
      branch: null,
      hasChanges: false,
      changedFiles: [],
      error: error instanceof Error ? error.message : "Failed to get status",
    });
  }
}

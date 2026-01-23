import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Octokit } from "octokit";
import { getSafeRepoPath, safeGit, validateRepoName, validateBranchName } from "@/lib/validation";

// Protected branches that we never push to directly
const PROTECTED_BRANCHES = ["main", "master", "production", "prod", "release"];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const accessToken = (session as { accessToken?: string }).accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "GitHub token not available" }, { status: 401 });
    }

    const { message, repoOwner, repoName, targetBranch } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Commit message required" }, { status: 400 });
    }

    if (!repoOwner || !repoName) {
      return NextResponse.json({ error: "Repository not selected" }, { status: 400 });
    }

    if (!validateRepoName(repoOwner) || !validateRepoName(repoName)) {
      return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
    }

    if (targetBranch && !validateBranchName(targetBranch)) {
      return NextResponse.json({ error: "Invalid target branch name" }, { status: 400 });
    }

    const repoPath = getSafeRepoPath(repoName);
    if (!repoPath) {
      return NextResponse.json({ error: "Invalid repository path" }, { status: 400 });
    }

    // targetBranch is what the PR will merge INTO (e.g., main)
    // We always create a new vibe/* branch and PR into targetBranch
    // This is safe - we never push directly to protected branches

    const octokit = new Octokit({ auth: accessToken });

    // Generate auto branch name: vibe/<date>-<time>-<short-slug>
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().slice(0, 5).replace(":", "");
    const slug = message.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 20).replace(/-+$/, "");
    const branchName = `vibe/${dateStr}-${timeStr}-${slug}`;

    // Create branch, commit, and push
    try {
      // Ensure we're on the default branch and up to date
      try {
        await safeGit(repoPath, ["fetch", "origin"], { timeout: 60000 });
        await safeGit(repoPath, ["checkout", targetBranch], { timeout: 30000 });
        await safeGit(repoPath, ["pull", "origin", targetBranch], { timeout: 60000 });
      } catch {
        // If target branch doesn't exist locally, try to create it from origin
        await safeGit(repoPath, ["fetch", "origin"], { timeout: 60000 });
        await safeGit(repoPath, ["checkout", "-b", targetBranch, `origin/${targetBranch}`], { timeout: 60000 });
      }

      // Checkout new branch
      await safeGit(repoPath, ["checkout", "-b", branchName], { timeout: 30000 });

      // Stage all changes
      await safeGit(repoPath, ["add", "-A"], { timeout: 30000 });

      // Commit with the message
      const commitMessage = `${message}\n\nUI change via Vibe Console`;
      await safeGit(repoPath, ["commit", "-m", commitMessage], { timeout: 30000 });

      // SAFETY CHECK: Only push vibe/* branches, never protected branches
      if (!branchName.startsWith("vibe/")) {
        throw new Error(`Safety: Refusing to push non-vibe branch: ${branchName}`);
      }
      if (PROTECTED_BRANCHES.includes(branchName)) {
        throw new Error(`Safety: Refusing to push to protected branch: ${branchName}`);
      }

      // Push the branch
      await safeGit(repoPath, ["push", "-u", "origin", branchName], { timeout: 60000 });
    } catch (gitError) {
      console.error("Git error:", gitError);
      // Try to reset to default branch on failure
      try {
        await safeGit(repoPath, ["checkout", targetBranch], { timeout: 10000 });
      } catch {
        try {
          await safeGit(repoPath, ["checkout", "main"], { timeout: 10000 });
        } catch {
          await safeGit(repoPath, ["checkout", "master"], { timeout: 10000 }).catch(() => {});
        }
      }
      return NextResponse.json({
        success: false,
        error: `Git operation failed: ${gitError instanceof Error ? gitError.message : "Unknown error"}`,
      });
    }

    // Create pull request
    try {
      const { data: pr } = await octokit.rest.pulls.create({
        owner: repoOwner,
        repo: repoName,
        title: message,
        body: `## UI Change

${message}

---

*Created via Vibe Console*`,
        head: branchName,
        base: targetBranch,
      });

      // Reset workspace back to default branch for next session
      await safeGit(repoPath, ["checkout", targetBranch]).catch(() => {});

      return NextResponse.json({
        success: true,
        prUrl: pr.html_url,
        prNumber: pr.number,
        branch: branchName,
      });
    } catch (prError) {
      console.error("PR creation error:", prError);
      return NextResponse.json({
        success: false,
        error: `Failed to create PR: ${prError instanceof Error ? prError.message : "Unknown error"}`,
        branch: branchName, // Branch was created, just PR failed
      });
    }
  } catch (error) {
    console.error("Create PR error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create PR",
    });
  }
}

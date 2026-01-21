import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Octokit } from "octokit";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "/workspace/guiido-carsharing";
const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "your-org";
const REPO_NAME = process.env.GITHUB_REPO_NAME || "guiido-carsharing";
const TARGET_BRANCH = "_ceo_preview";

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

    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Commit message required" }, { status: 400 });
    }

    const octokit = new Octokit({ auth: accessToken });

    // Generate branch name
    const timestamp = new Date().toISOString().split("T")[0];
    const slug = message.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30);
    const branchName = `ceo/${timestamp}-${slug}`;

    // Create branch, commit, and push
    try {
      // Checkout new branch
      await execAsync(
        `cd ${WORKSPACE_PATH} && git checkout -b ${branchName}`,
        { timeout: 30000 }
      );

      // Stage all changes
      await execAsync(
        `cd ${WORKSPACE_PATH} && git add -A`,
        { timeout: 30000 }
      );

      // Commit with the message
      const commitMessage = `${message}\n\nCEO UI change via Vibe Console`;
      await execAsync(
        `cd ${WORKSPACE_PATH} && git commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
        { timeout: 30000 }
      );

      // Push the branch
      await execAsync(
        `cd ${WORKSPACE_PATH} && git push -u origin ${branchName}`,
        { timeout: 60000 }
      );
    } catch (gitError) {
      console.error("Git error:", gitError);
      // Try to reset to main branch on failure
      await execAsync(`cd ${WORKSPACE_PATH} && git checkout main || git checkout master`).catch(() => {});
      return NextResponse.json({
        success: false,
        error: `Git operation failed: ${gitError instanceof Error ? gitError.message : "Unknown error"}`,
      });
    }

    // Create pull request
    try {
      const { data: pr } = await octokit.rest.pulls.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: message,
        body: `## CEO UI Change

${message}

---

*Created via Guiido Vibe Console*`,
        head: branchName,
        base: TARGET_BRANCH,
      });

      // Reset workspace back to main for next session
      await execAsync(`cd ${WORKSPACE_PATH} && git checkout main || git checkout master`).catch(() => {});

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

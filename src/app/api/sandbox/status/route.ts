import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");

    if (!repo) {
      return NextResponse.json({
        branch: null,
        hasChanges: false,
        changedFiles: [],
      });
    }

    const repoPath = `${WORKSPACE_PATH}/${repo}`;

    // Get git status
    const { stdout: statusOutput } = await execAsync(
      `cd ${repoPath} && git status --porcelain`,
      { timeout: 10000 }
    );

    // Get current branch
    const { stdout: branchOutput } = await execAsync(
      `cd ${repoPath} && git branch --show-current`,
      { timeout: 10000 }
    );

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

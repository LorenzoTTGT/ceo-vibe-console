import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "/workspace/guiido-carsharing";

export async function GET() {
  try {
    // Get git status
    const { stdout: statusOutput } = await execAsync(
      `cd ${WORKSPACE_PATH} && git status --porcelain`,
      { timeout: 10000 }
    );

    // Get current branch
    const { stdout: branchOutput } = await execAsync(
      `cd ${WORKSPACE_PATH} && git branch --show-current`,
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
      error: error instanceof Error ? error.message : "Failed to get status",
    });
  }
}

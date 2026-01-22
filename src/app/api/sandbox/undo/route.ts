import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

export async function POST(request: NextRequest) {
  try {
    const { repo } = await request.json();

    if (!repo) {
      return NextResponse.json({ error: "Repository is required" }, { status: 400 });
    }

    const repoPath = `${WORKSPACE_PATH}/${repo}`;

    // Undo the last uncommitted changes (restore from git)
    const { stdout, stderr } = await execAsync(
      `cd ${repoPath} && git checkout -- .`,
      { timeout: 30000 }
    );

    return NextResponse.json({
      success: true,
      message: "Changes reverted",
      output: stdout || stderr,
    });
  } catch (error) {
    console.error("Undo error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to undo changes",
    });
  }
}

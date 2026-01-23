import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSafeRepoPath, safeGit } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { repo } = await request.json();

    if (!repo) {
      return NextResponse.json({ error: "Repository is required" }, { status: 400 });
    }

    const repoPath = getSafeRepoPath(repo);
    if (!repoPath) {
      return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
    }

    // Undo the last uncommitted changes (restore from git)
    const { stdout, stderr } = await safeGit(repoPath, ["checkout", "--", "."], { timeout: 30000 });

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

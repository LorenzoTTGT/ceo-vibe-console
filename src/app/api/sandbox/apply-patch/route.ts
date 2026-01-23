import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSafeRepoPath, execFileAsync } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { patch, repo } = await request.json();

    if (!patch) {
      return NextResponse.json({ error: "Patch is required" }, { status: 400 });
    }

    if (!repo) {
      return NextResponse.json({ error: "Repository is required" }, { status: 400 });
    }

    const repoPath = getSafeRepoPath(repo);
    if (!repoPath) {
      return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
    }

    // Save patch to temp file
    const tempDir = "/tmp/vibe-patches";
    await mkdir(tempDir, { recursive: true });
    const patchFile = path.join(tempDir, `patch-${Date.now()}.patch`);
    await writeFile(patchFile, patch);

    // Apply the patch
    try {
      await execFileAsync("git", ["-C", repoPath, "apply", "--check", patchFile], { timeout: 30000 });
      const { stdout, stderr } = await execFileAsync("git", ["-C", repoPath, "apply", patchFile], { timeout: 30000 });

      return NextResponse.json({
        success: true,
        message: "Patch applied successfully",
        output: stdout || stderr,
      });
    } catch {
      // Try with --3way for better conflict handling
      try {
        const { stdout, stderr } = await execFileAsync(
          "git", ["-C", repoPath, "apply", "--3way", patchFile],
          { timeout: 30000 }
        );

        return NextResponse.json({
          success: true,
          message: "Patch applied with 3-way merge",
          output: stdout || stderr,
        });
      } catch (threeWayError) {
        return NextResponse.json({
          success: false,
          error: "Failed to apply patch",
          details: threeWayError instanceof Error ? threeWayError.message : "Unknown error",
        });
      }
    }
  } catch (error) {
    console.error("Apply patch error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply patch",
    });
  }
}

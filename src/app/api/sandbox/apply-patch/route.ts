import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

export async function POST(request: NextRequest) {
  try {
    const { patch, repo } = await request.json();

    if (!patch) {
      return NextResponse.json({ error: "Patch is required" }, { status: 400 });
    }

    if (!repo) {
      return NextResponse.json({ error: "Repository is required" }, { status: 400 });
    }

    const repoPath = `${WORKSPACE_PATH}/${repo}`;

    // Save patch to temp file
    const tempDir = "/tmp/vibe-patches";
    await mkdir(tempDir, { recursive: true });
    const patchFile = path.join(tempDir, `patch-${Date.now()}.patch`);
    await writeFile(patchFile, patch);

    // Apply the patch
    try {
      const { stdout, stderr } = await execAsync(
        `cd ${repoPath} && git apply --check ${patchFile} && git apply ${patchFile}`,
        { timeout: 30000 }
      );

      return NextResponse.json({
        success: true,
        message: "Patch applied successfully",
        output: stdout || stderr,
      });
    } catch (applyError) {
      // Try with --3way for better conflict handling
      try {
        const { stdout, stderr } = await execAsync(
          `cd ${repoPath} && git apply --3way ${patchFile}`,
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

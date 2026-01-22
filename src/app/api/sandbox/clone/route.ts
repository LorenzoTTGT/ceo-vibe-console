import { NextRequest, NextResponse } from "next/server";
import { auth, getCurrentUser } from "@/lib/auth";
import { getOrCreateRepo } from "@/db/helpers";
import { exec } from "child_process";
import { promisify } from "util";
import { access, mkdir } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const user = await getCurrentUser();

    if (!session?.user || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const accessToken = session.accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "GitHub token not available" }, { status: 401 });
    }

    const { repoOwner, repoName, defaultBranch, fullName, step } = await request.json();

    if (!repoOwner || !repoName) {
      return NextResponse.json({ error: "Repository info required" }, { status: 400 });
    }

    const repoPath = path.join(WORKSPACE_PATH, repoName);

    // Step 1: Clone
    if (!step || step === "clone") {
      // Ensure workspace directory exists
      await mkdir(WORKSPACE_PATH, { recursive: true });

      // Check if repo already exists on disk
      let alreadyExists = false;
      try {
        await access(path.join(repoPath, ".git"));
        alreadyExists = true;

        // Repo exists, pull latest
        await execAsync(`cd ${repoPath} && git fetch origin && git pull origin HEAD`, {
          timeout: 120000,
        });
      } catch {
        // Repo doesn't exist, clone it
        const cloneUrl = `https://${accessToken}@github.com/${repoOwner}/${repoName}.git`;

        await execAsync(`git clone ${cloneUrl} ${repoPath}`, {
          timeout: 300000, // 5 minutes for large repos
        });
      }

      // Save to database
      getOrCreateRepo(user.id, {
        name: repoName,
        owner: repoOwner,
        fullName: fullName || `${repoOwner}/${repoName}`,
        defaultBranch: defaultBranch || "main",
      });

      return NextResponse.json({
        success: true,
        step: "clone",
        message: alreadyExists ? "Repository updated" : "Repository cloned",
        path: repoPath,
        alreadyExists,
      });
    }

    // Step 2: Install dependencies
    if (step === "install") {
      try {
        // Check if package.json exists
        await access(path.join(repoPath, "package.json"));

        // Check if node_modules exists
        let needsInstall = true;
        try {
          await access(path.join(repoPath, "node_modules"));
          needsInstall = false;
        } catch {
          // node_modules doesn't exist
        }

        if (needsInstall) {
          // Detect package manager (pnpm, yarn, or npm)
          let installCmd = "npm install";
          try {
            await access(path.join(repoPath, "pnpm-lock.yaml"));
            installCmd = "pnpm install";
          } catch {
            try {
              await access(path.join(repoPath, "yarn.lock"));
              installCmd = "yarn install";
            } catch {
              // Use npm
            }
          }

          await execAsync(`cd ${repoPath} && ${installCmd}`, {
            timeout: 300000, // 5 minutes for install
          });
        }

        return NextResponse.json({
          success: true,
          step: "install",
          message: needsInstall ? "Dependencies installed" : "Dependencies already installed",
          skipped: !needsInstall,
        });
      } catch {
        // No package.json, skip install
        return NextResponse.json({
          success: true,
          step: "install",
          message: "No package.json found, skipping install",
          skipped: true,
        });
      }
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error) {
    console.error("Clone/install error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to setup repository",
    });
  }
}

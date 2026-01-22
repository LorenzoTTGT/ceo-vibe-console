import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepoByName } from "@/db/helpers";
import { writeFile, readFile, access } from "fs/promises";
import path from "path";

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

// GET - Get env vars for a repo (reads directly from .env.local file)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repoName = searchParams.get("repo");
    const fromFile = searchParams.get("fromFile") === "true";

    if (!repoName) {
      return NextResponse.json({ error: "Repo name required" }, { status: 400 });
    }

    const repoPath = path.join(WORKSPACE_PATH, repoName);
    const envFilePath = path.join(repoPath, ".env.local");

    // Try to read directly from file
    if (fromFile) {
      try {
        await access(envFilePath);
        const content = await readFile(envFilePath, "utf-8");
        return NextResponse.json({ content });
      } catch {
        // File doesn't exist
        return NextResponse.json({ content: null });
      }
    }

    // Fallback: return empty (we no longer use database for env vars)
    return NextResponse.json({ envVars: {} });
  } catch (error) {
    console.error("Get env vars error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to get env vars",
    }, { status: 500 });
  }
}

// POST - Save env vars directly to .env.local file
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { repoName, envContent } = await request.json();

    if (!repoName) {
      return NextResponse.json({ error: "Repo name required" }, { status: 400 });
    }

    if (!envContent) {
      return NextResponse.json({ error: "Env content required" }, { status: 400 });
    }

    const repoPath = path.join(WORKSPACE_PATH, repoName);

    // Check repo exists on disk
    try {
      await access(repoPath);
    } catch {
      return NextResponse.json({ error: "Repository not found on disk" }, { status: 404 });
    }

    // Write .env.local directly (no database, no truncation)
    await writeFile(path.join(repoPath, ".env.local"), envContent + "\n");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save env vars error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to save env vars",
    }, { status: 500 });
  }
}

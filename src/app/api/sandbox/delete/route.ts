import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepoByName } from "@/db/helpers";
import { getDb, schema } from "@/db/index";
import { eq } from "drizzle-orm";
import { rm } from "fs/promises";
import path from "path";

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { repoName } = await request.json();

    if (!repoName) {
      return NextResponse.json({ error: "Repository name required" }, { status: 400 });
    }

    // Get repo from database
    const repo = getRepoByName(user.id, repoName);
    if (!repo) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }

    const db = getDb();

    // Delete env vars first (foreign key)
    db.delete(schema.envVars).where(eq(schema.envVars.repoId, repo.id)).run();

    // Delete repo from database
    db.delete(schema.repos).where(eq(schema.repos.id, repo.id)).run();

    // Delete from disk
    const repoPath = path.join(WORKSPACE_PATH, repoName);
    try {
      await rm(repoPath, { recursive: true, force: true });
    } catch (err) {
      console.error("Failed to delete repo from disk:", err);
      // Continue even if disk delete fails - DB is already cleaned
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete repo error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to delete repository",
    }, { status: 500 });
  }
}

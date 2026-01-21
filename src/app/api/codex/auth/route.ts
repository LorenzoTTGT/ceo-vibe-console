import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Start codex auth flow - this typically opens a browser
    // We'll capture the auth URL and return it for the frontend to open
    const { stdout, stderr } = await execAsync("codex auth login --no-browser 2>&1 || codex login --no-browser 2>&1", {
      timeout: 30000,
    });

    // Try to extract auth URL from output
    const output = stdout + stderr;
    const urlMatch = output.match(/https:\/\/[^\s]+/);

    if (urlMatch) {
      return NextResponse.json({ authUrl: urlMatch[0] });
    }

    // If no URL found, the auth might work differently
    // Try triggering browser-based auth
    try {
      // This will attempt to open browser auth
      exec("codex auth login", { timeout: 5000 });
      return NextResponse.json({
        message: "Auth flow started in browser. Please complete the sign-in.",
        authStarted: true,
      });
    } catch {
      return NextResponse.json({
        error: "Could not start auth flow. Please run 'codex auth login' manually.",
      });
    }
  } catch (error) {
    console.error("Codex auth error:", error);
    return NextResponse.json({
      error: "Failed to start authentication. Ensure codex CLI is installed.",
    });
  }
}

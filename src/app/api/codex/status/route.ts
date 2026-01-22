import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  try {
    // Check if codex CLI is installed
    try {
      await execAsync("which codex");
    } catch {
      return NextResponse.json({ installed: false, authenticated: false });
    }

    // Check if codex is authenticated
    try {
      const { stdout: version } = await execAsync("codex --version");

      // Check login status with the correct command
      const { stdout: loginStatus } = await execAsync("codex login status 2>&1");
      const isAuthenticated = loginStatus.toLowerCase().includes("logged in");

      return NextResponse.json({
        installed: true,
        authenticated: isAuthenticated,
        version: version.trim(),
        status: loginStatus.trim(),
      });
    } catch {
      return NextResponse.json({ installed: true, authenticated: false });
    }
  } catch (error) {
    console.error("Codex status check error:", error);
    return NextResponse.json({ installed: false, authenticated: false, error: "Check failed" });
  }
}

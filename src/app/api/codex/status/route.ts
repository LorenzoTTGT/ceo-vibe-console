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
      const { stdout } = await execAsync("codex --version");
      // Try a simple auth check - this may vary based on codex CLI behavior
      // For now, we assume if codex is installed and can run, we need to check auth separately

      // Check for auth config file or try a simple authenticated request
      const authCheck = await execAsync("codex auth status 2>&1 || echo 'not-auth'");
      const isAuthenticated = !authCheck.stdout.includes("not-auth") &&
                             !authCheck.stdout.includes("not authenticated") &&
                             !authCheck.stdout.includes("please login");

      return NextResponse.json({
        installed: true,
        authenticated: isAuthenticated,
        version: stdout.trim(),
      });
    } catch {
      return NextResponse.json({ installed: true, authenticated: false });
    }
  } catch (error) {
    console.error("Codex status check error:", error);
    return NextResponse.json({ installed: false, authenticated: false, error: "Check failed" });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { execFileAsync } from "@/lib/validation";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if codex CLI is installed
    try {
      await execFileAsync("which", ["codex"]);
    } catch {
      return NextResponse.json({ installed: false, authenticated: false });
    }

    // Check if codex is authenticated
    try {
      const { stdout: version } = await execFileAsync("codex", ["--version"]);

      // Check login status with the correct command
      const { stdout: loginStatus } = await execFileAsync("codex", ["login", "status"]);
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

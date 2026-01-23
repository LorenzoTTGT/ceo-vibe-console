import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { homedir } from "os";
import path from "path";
import { auth } from "@/lib/auth";
import { execFileAsync } from "@/lib/validation";

async function getCodexEmail(): Promise<string | null> {
  try {
    const authPath = path.join(homedir(), ".codex", "auth.json");
    const raw = await readFile(authPath, "utf-8");
    const data = JSON.parse(raw);
    // Decode the id_token JWT payload (base64url) to get email
    const idToken = data?.tokens?.id_token;
    if (!idToken) return null;
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
    return payload?.email || null;
  } catch {
    return null;
  }
}

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

      // Get the logged-in OpenAI email
      const codexEmail = isAuthenticated ? await getCodexEmail() : null;

      return NextResponse.json({
        installed: true,
        authenticated: isAuthenticated,
        version: version.trim(),
        status: loginStatus.trim(),
        codexEmail,
      });
    } catch {
      return NextResponse.json({ installed: true, authenticated: false });
    }
  } catch (error) {
    console.error("Codex status check error:", error);
    return NextResponse.json({ installed: false, authenticated: false, error: "Check failed" });
  }
}

import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { homedir } from "os";
import path from "path";
import { auth } from "@/lib/auth";
import { execFileAsync } from "@/lib/validation";

interface AuthFileData {
  email: string | null;
  hasValidTokens: boolean;
}

async function readAuthFile(): Promise<AuthFileData | null> {
  try {
    const authPath = path.join(homedir(), ".codex", "auth.json");
    const raw = await readFile(authPath, "utf-8");
    const data = JSON.parse(raw);

    // Check if there are valid tokens
    const idToken = data?.tokens?.id_token;
    const accessToken = data?.tokens?.access_token;
    const hasValidTokens = !!(idToken && accessToken);

    // Decode the id_token JWT payload (base64url) to get email
    let email: string | null = null;
    if (idToken) {
      try {
        const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
        email = payload?.email || null;
      } catch {
        // Invalid JWT
      }
    }

    return { email, hasValidTokens };
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

      // Check login status - try CLI first, then fall back to auth file
      let isAuthenticated = false;
      let loginStatus = "";

      try {
        const result = await execFileAsync("codex", ["login", "status"]);
        loginStatus = result.stdout.trim();
        isAuthenticated = loginStatus.toLowerCase().includes("logged in");
      } catch {
        // CLI might fail, check auth file directly
      }

      // If CLI didn't confirm auth, check auth file as fallback
      // This handles the case where auth just completed but CLI cache is stale
      const authFile = await readAuthFile();
      if (!isAuthenticated && authFile?.hasValidTokens) {
        isAuthenticated = true;
        loginStatus = "Logged in (from auth file)";
      }

      console.log("[codex status]", { version: version.trim(), loginStatus, isAuthenticated, authFile });

      return NextResponse.json({
        installed: true,
        authenticated: isAuthenticated,
        version: version.trim(),
        status: loginStatus,
        codexEmail: authFile?.email || null,
      });
    } catch (err) {
      console.log("[codex status error]", err);
      return NextResponse.json({ installed: true, authenticated: false });
    }
  } catch (error) {
    console.error("Codex status check error:", error);
    return NextResponse.json({ installed: false, authenticated: false, error: "Check failed" });
  }
}

import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { auth } from "@/lib/auth";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Run device-auth flow via spawn so we can read output without blocking
    const result = await new Promise<{ stdout: string; error?: string }>((resolve) => {
      let stdout = "";
      let stderr = "";
      let resolved = false;

      const proc = spawn("codex", ["login", "--device-auth"], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        // Once we detect a URL in the output, resolve immediately
        if (!resolved && /https?:\/\/\S+/.test(stdout)) {
          resolved = true;
          proc.unref(); // Let process continue in background
          resolve({ stdout });
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          resolve({ stdout, error: err.message });
        }
      });

      proc.on("close", () => {
        if (!resolved) {
          resolved = true;
          resolve({ stdout, error: stderr || undefined });
        }
      });

      // Timeout after 10 seconds if no URL detected
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          proc.unref();
          resolve({ stdout, error: stdout ? undefined : "Timed out waiting for device auth output" });
        }
      }, 10000);
    });

    if (result.error && !result.stdout) {
      return NextResponse.json({
        error: result.error,
        manual: true,
      });
    }

    // Strip ANSI escape codes before parsing
    const clean = result.stdout.replace(/\x1b\[[0-9;]*m/g, "");

    // Parse URL and device code from cleaned output
    const urlMatch = clean.match(/https?:\/\/\S+/);
    const codeMatch = clean.match(/\b([A-Z0-9]{3,}-[A-Z0-9]{3,})\b/i);

    if (urlMatch) {
      return NextResponse.json({
        authUrl: urlMatch[0].replace(/[.,;:]+$/, ""), // trim trailing punctuation
        deviceCode: codeMatch ? codeMatch[1] : null,
        authStarted: true,
        rawOutput: result.stdout,
      });
    }

    // Could not parse, return raw output so user can still follow instructions
    return NextResponse.json({
      authStarted: true,
      rawOutput: result.stdout,
    });
  } catch (error) {
    console.error("Codex auth error:", error);
    return NextResponse.json({
      error: "Could not start auth flow. Is codex installed?",
      manual: true,
    });
  }
}

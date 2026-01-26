import { NextResponse } from "next/server";
import { spawn, execFile, ChildProcess } from "child_process";
import { promisify } from "util";
import { auth } from "@/lib/auth";

const execFileAsync = promisify(execFile);

// Keep track of the auth process so it stays alive
let activeAuthProcess: ChildProcess | null = null;

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Kill any existing auth process
    if (activeAuthProcess) {
      try {
        activeAuthProcess.kill();
      } catch {
        // Ignore
      }
      activeAuthProcess = null;
    }

    // Run device-auth flow via spawn so we can read output without blocking
    const result = await new Promise<{ stdout: string; error?: string }>((resolve) => {
      let stdout = "";
      let stderr = "";
      let resolved = false;

      const proc = spawn("codex", ["login", "--device-auth"], {
        stdio: ["ignore", "pipe", "pipe"],
        // Don't detach - keep process attached so it survives
      });

      // Store reference to keep process alive
      activeAuthProcess = proc;

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        // Once we detect a URL in the output, resolve immediately
        // but DON'T detach - keep process running
        if (!resolved && /https?:\/\/\S+/.test(stdout)) {
          resolved = true;
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
        activeAuthProcess = null;
      });

      proc.on("close", () => {
        if (!resolved) {
          resolved = true;
          resolve({ stdout, error: stderr || undefined });
        }
        activeAuthProcess = null;
      });

      // Timeout after 10 seconds if no URL detected
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
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

    // Extract device code from ANSI-colored output BEFORE stripping
    // The code is the second value wrapped in \x1b[94m...\x1b[0m (first is the URL)
    const ansiHighlighted = [...result.stdout.matchAll(/\x1b\[94m([^\x1b]+)\x1b\[0m/g)].map(m => m[1].trim());
    const deviceCode = ansiHighlighted.find(s => /^[A-Z0-9]{4,}-[A-Z0-9]{4,}$/i.test(s)) || null;

    // Strip ANSI escape codes for URL parsing
    const clean = result.stdout.replace(/\x1b\[[0-9;]*m/g, "");

    // Parse URL from cleaned output
    const urlMatch = clean.match(/https?:\/\/\S+/);

    if (urlMatch) {
      return NextResponse.json({
        authUrl: urlMatch[0].replace(/[.,;:]+$/, ""), // trim trailing punctuation
        deviceCode,
        authStarted: true,
        rawOutput: clean,
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

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await execFileAsync("codex", ["logout"], { timeout: 10000 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Codex logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}

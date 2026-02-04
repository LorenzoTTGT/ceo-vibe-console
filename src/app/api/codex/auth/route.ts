import { NextResponse } from "next/server";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { auth } from "@/lib/auth";
import { writeFile, readFile, unlink } from "fs/promises";
import { homedir, tmpdir } from "os";
import path from "path";

const execFileAsync = promisify(execFile);

// PID file to track the background auth process
const AUTH_PID_FILE = path.join(tmpdir(), "codex-auth.pid");

async function killExistingAuthProcess() {
  try {
    const pid = await readFile(AUTH_PID_FILE, "utf-8");
    if (pid) {
      try {
        process.kill(parseInt(pid.trim(), 10), "SIGTERM");
      } catch {
        // Process already dead
      }
      await unlink(AUTH_PID_FILE);
    }
  } catch {
    // No PID file
  }
}

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Kill any existing auth process
    await killExistingAuthProcess();

    // Run device-auth flow via spawn
    // Use shell with nohup to ensure process survives even if parent dies
    const result = await new Promise<{ stdout: string; error?: string }>((resolve) => {
      let stdout = "";
      let stderr = "";
      let resolved = false;

      // Start codex in detached mode so it survives if the API handler exits
      const proc = spawn("codex", ["login", "--device-auth"], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: true, // Run in separate process group (critical for survival)
        env: {
          ...process.env,
          // Ensure HOME is set for codex to find/write config
          HOME: homedir(),
        },
      });

      // Save PID to file so we can track/kill it later
      if (proc.pid) {
        writeFile(AUTH_PID_FILE, String(proc.pid)).catch(() => {});
      }

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        console.log("[codex auth stdout]", chunk.toString());
        // Once we detect a URL in the output, resolve immediately
        // Then unref the process so it runs in background
        if (!resolved && /https?:\/\/\S+/.test(stdout)) {
          resolved = true;
          // Unref so Node.js doesn't wait for this process
          // The process will continue polling OpenAI in background
          proc.unref();
          resolve({ stdout });
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        console.log("[codex auth stderr]", chunk.toString());
      });

      proc.on("error", (err) => {
        console.error("[codex auth error]", err);
        if (!resolved) {
          resolved = true;
          resolve({ stdout, error: err.message });
        }
      });

      proc.on("close", (code) => {
        console.log("[codex auth close]", code);
        // Clean up PID file when process ends
        unlink(AUTH_PID_FILE).catch(() => {});
        if (!resolved) {
          resolved = true;
          resolve({ stdout, error: stderr || undefined });
        }
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

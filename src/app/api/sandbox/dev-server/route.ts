import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spawn } from "child_process";
import { access } from "fs/promises";
import path from "path";
import { createServer } from "net";
import { getSafeRepoPath, execFileAsync } from "@/lib/validation";

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";
// Preview URL for production (Coolify) - falls back to localhost for local dev
const PREVIEW_BASE_URL = process.env.NEXT_PUBLIC_PREVIEW_URL || "http://localhost";

// Track running dev server
let devServerProcess: ReturnType<typeof spawn> | null = null;
let currentRepo: string | null = null;
let currentPort: number | null = null;
let serverLogs: string[] = [];
const MAX_LOGS = 500; // Keep last 500 lines
const PREFERRED_PORT = 3001; // Always try to use this port

// Build the preview URL - uses env var in production, localhost:port in dev
function getPreviewUrl(port: number): string {
  // If NEXT_PUBLIC_PREVIEW_URL is set (production), use it directly (no port needed, reverse proxy handles it)
  if (process.env.NEXT_PUBLIC_PREVIEW_URL) {
    return process.env.NEXT_PUBLIC_PREVIEW_URL;
  }
  // Local dev - use localhost with port
  return `http://localhost:${port}`;
}

// Find an available port starting from preferred port
async function findAvailablePort(startPort: number = 3001): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
    server.on("error", () => {
      // Port in use, try next one
      if (startPort < 3100) {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(new Error("No available ports found"));
      }
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { repoName, action } = await request.json();

    if (action === "stop") {
      if (devServerProcess) {
        // Kill the process group to ensure all children are killed
        try {
          process.kill(-devServerProcess.pid!, "SIGTERM");
        } catch {
          devServerProcess.kill("SIGTERM");
        }
        devServerProcess = null;
        currentRepo = null;
        // Also kill any lingering process on the port
        if (currentPort) {
          try {
            await execFileAsync("bash", ["-c", `lsof -ti:${currentPort} | xargs kill -9 2>/dev/null || true`]);
          } catch {
            // Ignore
          }
        }
        currentPort = null;
      }
      return NextResponse.json({ success: true, message: "Dev server stopped" });
    }

    if (!repoName) {
      return NextResponse.json({ error: "Repository name required" }, { status: 400 });
    }

    const repoPath = getSafeRepoPath(repoName);
    if (!repoPath) {
      return NextResponse.json({ error: "Invalid repository name" }, { status: 400 });
    }

    // Check if repo exists
    try {
      await access(repoPath);
    } catch {
      return NextResponse.json({
        success: false,
        error: "Repository not cloned. Clone it first.",
      });
    }

    // If same repo is already running, return success
    if (currentRepo === repoName && devServerProcess && currentPort) {
      return NextResponse.json({
        success: true,
        message: "Dev server already running",
        port: currentPort,
        url: getPreviewUrl(currentPort),
      });
    }

    // Stop existing server if different repo
    if (devServerProcess) {
      // Kill the process group to ensure all children are killed
      try {
        process.kill(-devServerProcess.pid!, "SIGTERM");
      } catch {
        devServerProcess.kill("SIGTERM");
      }
      devServerProcess = null;
      // Wait a moment for port to be released
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Also kill any process on our preferred port
    try {
      await execFileAsync("bash", ["-c", `lsof -ti:${PREFERRED_PORT} | xargs kill -9 2>/dev/null || true`]);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch {
      // Ignore - no process on port
    }

    // Install dependencies if node_modules doesn't exist
    try {
      await access(path.join(repoPath, "node_modules"));
    } catch {
      await execFileAsync("npm", ["install"], { cwd: repoPath, timeout: 300000 });
    }

    // Find an available port (prefer 3001)
    const port = await findAvailablePort(PREFERRED_PORT);
    currentPort = port;

    // Clear previous logs
    serverLogs = [];

    // Start dev server with log capture
    // Use a clean environment to avoid inheriting Turbopack settings from ceo-vibe-console (Next.js 16)
    const cleanEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      SHELL: process.env.SHELL,
      NODE_ENV: "development",
      // Pass through necessary env vars but NOT Next.js internal ones
    };

    devServerProcess = spawn("npx", ["next", "dev", "-p", String(port)], {
      cwd: repoPath,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: cleanEnv,
    });

    // Capture stdout
    devServerProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        serverLogs.push(`[stdout] ${line}`);
        if (serverLogs.length > MAX_LOGS) serverLogs.shift();
      }
    });

    // Capture stderr
    devServerProcess.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        serverLogs.push(`[stderr] ${line}`);
        if (serverLogs.length > MAX_LOGS) serverLogs.shift();
      }
    });

    devServerProcess.on("error", (err) => {
      serverLogs.push(`[error] Process error: ${err.message}`);
    });

    devServerProcess.on("exit", (code) => {
      serverLogs.push(`[exit] Process exited with code ${code}`);
    });

    currentRepo = repoName;

    // Wait a bit for server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return NextResponse.json({
      success: true,
      message: "Dev server started",
      port: port,
      url: getPreviewUrl(port),
    });
  } catch (error) {
    console.error("Dev server error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start dev server",
    });
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const logsOnly = searchParams.get("logs") === "true";
  const lastN = parseInt(searchParams.get("last") || "100", 10);

  if (logsOnly) {
    return NextResponse.json({
      logs: serverLogs.slice(-lastN),
    });
  }

  return NextResponse.json({
    running: devServerProcess !== null,
    repo: currentRepo,
    port: currentPort,
    url: currentPort ? getPreviewUrl(currentPort) : null,
    logs: serverLogs.slice(-50), // Include last 50 lines by default
  });
}

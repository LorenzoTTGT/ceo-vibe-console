const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const { installCLIs } = require("./cli-installer");
const { buildMenu } = require("./menu");

// Load environment variables from user data folder
function loadUserEnv() {
  const userData = app.getPath("userData");
  const envPath = path.join(userData, ".env.local");

  if (fs.existsSync(envPath)) {
    console.log("[env] Loading from", envPath);
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex);
      let value = trimmed.substring(eqIndex + 1);

      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Only set if not already set (allow env override)
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } else {
    console.log("[env] No .env.local found at", envPath);
  }
}

// Fix PATH for macOS/Linux GUI apps that don't inherit shell environment
function fixPath() {
  if (process.platform !== "darwin" && process.platform !== "linux") return;

  const currentPath = process.env.PATH || "";

  // Try sourcing the user's shell profile
  try {
    const userShell = process.env.SHELL || "/bin/zsh";
    const output = execSync(
      `${userShell} -lc 'echo "__PATH_START__$PATH__PATH_END__"'`,
      { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }
    );
    const match = output.match(/__PATH_START__(.+)__PATH_END__/);
    if (match) {
      process.env.PATH = match[1];
      return;
    }
  } catch {}

  // Fallback: append common paths that GUI apps miss
  const extraPaths = [
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    `${process.env.HOME}/.nvm/versions/node/current/bin`,
    `${process.env.HOME}/.npm-global/bin`,
    `${process.env.HOME}/.volta/bin`,
    "/usr/local/sbin",
  ];
  const missing = extraPaths.filter((p) => !currentPath.includes(p));
  if (missing.length) {
    process.env.PATH = currentPath + ":" + missing.join(":");
  }
}
fixPath();

let PORT = 3100; // Use 3100 to avoid conflicts with sandbox on 3000/3001
const isDev = !app.isPackaged;

let mainWindow = null;
let serverProcess = null;

function getResourcePath(...segments) {
  if (isDev) {
    return path.join(__dirname, "..", ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

// Find which port Next.js actually started on by checking a marker file
async function findDevServerPort() {
  // In dev mode, Next.js writes its port to stdout which we can't easily capture
  // So we'll probe common ports to find the Vibe Console server
  const http = require("http");
  const ports = [3100, 3101, 3102, 3000, 3001, 3002];

  for (const port of ports) {
    try {
      const isVibeConsole = await new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/api/auth/session`, (res) => {
          // Vibe Console will return 200 with JSON, sandbox might not have this endpoint
          resolve(res.statusCode === 200);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(1000, () => {
          req.destroy();
          resolve(false);
        });
      });

      if (isVibeConsole) {
        console.log(`[electron] Found Vibe Console on port ${port}`);
        return port;
      }
    } catch {
      // Try next port
    }
  }

  // Fallback to 3000
  console.log("[electron] Could not find Vibe Console, falling back to port 3000");
  return 3000;
}

async function startNextServer() {
  if (isDev) {
    // In dev mode, we use --port 3100 in package.json, so PORT is already correct
    // The wait-on in package.json ensures the server is ready
    console.log(`[electron] Dev mode - using port ${PORT}`);
    return;
  }

  // Production: require the standalone server.js in-process
  const serverPath = getResourcePath(".next", "standalone", "server.js");
  process.env.PORT = String(PORT);
  process.env.HOSTNAME = "localhost";
  require(serverPath);
}

/**
 * Wait for the Next.js server to be ready (production only)
 * Polls the server until it responds or times out
 */
async function waitForServerReady(maxWaitMs = 30000, intervalMs = 500) {
  const http = require("http");
  const startTime = Date.now();

  console.log(`[electron] Waiting for server on port ${PORT}...`);

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const isReady = await new Promise((resolve) => {
        const req = http.get(`http://localhost:${PORT}/`, (res) => {
          resolve(res.statusCode === 200 || res.statusCode === 302);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(1000, () => {
          req.destroy();
          resolve(false);
        });
      });

      if (isReady) {
        console.log(`[electron] Server ready after ${Date.now() - startTime}ms`);
        return true;
      }
    } catch {
      // Server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  console.log(`[electron] Server not ready after ${maxWaitMs}ms, proceeding anyway`);
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Vibe Console",
  });

  console.log(`[electron] Loading http://localhost:${PORT}`);
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // All navigation stays in the Electron window (OAuth needs this)
  // Only window.open() to non-localhost URLs opens in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Set data paths for the app
  const userData = app.getPath("userData");
  process.env.DATA_DIR = process.env.DATA_DIR || userData;
  process.env.SANDBOX_WORKSPACE_PATH =
    process.env.SANDBOX_WORKSPACE_PATH || path.join(userData, "workspace");

  // Install CLI tools if missing
  await installCLIs();

  // Build app menu
  buildMenu();

  // Start the Next.js server
  await startNextServer();

  // Wait for server to be ready in production (with proper readiness check)
  if (!isDev) {
    await waitForServerReady();
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

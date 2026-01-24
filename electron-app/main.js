const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { execSync } = require("child_process");
const { installCLIs } = require("./cli-installer");
const { buildMenu } = require("./menu");

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

const PORT = 3000;
const isDev = !app.isPackaged;

let mainWindow = null;
let serverProcess = null;

function getResourcePath(...segments) {
  if (isDev) {
    return path.join(__dirname, "..", ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

async function startNextServer() {
  if (isDev) {
    // In dev mode, assume `next dev` is already running via concurrently
    return;
  }

  // Production: require the standalone server.js in-process
  const serverPath = getResourcePath(".next", "standalone", "server.js");
  process.env.PORT = String(PORT);
  process.env.HOSTNAME = "localhost";
  require(serverPath);
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

  // Wait briefly for server to be ready in production
  if (!isDev) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

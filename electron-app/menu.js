const { app, Menu, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");

function buildMenu() {
  const isMac = process.platform === "darwin";

  // Lazy-load electron-updater to avoid crash in dev mode
  let autoUpdater;
  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch (e) {
    autoUpdater = null;
  }

  if (autoUpdater) {
    // Configure auto-updater
    autoUpdater.autoDownload = false;

  autoUpdater.on("update-available", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      buttons: ["Download", "Later"],
      defaultId: 0,
      title: "Update Available",
      message: `A new version (${info.version}) is available.`,
      detail: "Would you like to download it now?",
    });

    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-not-available", () => {
    dialog.showMessageBox({
      type: "info",
      title: "No Updates",
      message: "You are running the latest version.",
    });
  });

  autoUpdater.on("update-downloaded", async () => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      title: "Update Ready",
      message: "Update downloaded. Restart to apply?",
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (err) => {
    dialog.showErrorBox(
      "Update Error",
      `Failed to check for updates: ${err.message}`
    );
  });

    // Check for updates silently on launch
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {});
    }
  }

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Download Setup Template (.env.local)",
          click: async () => {
            const template = `# Vibe Console - Environment Configuration
# ===========================================
# Copy this file to the app's data folder as .env.local
#
# On Windows: %APPDATA%\\vibe-console\\.env.local
# On macOS: ~/Library/Application Support/vibe-console/.env.local
# On Linux: ~/.config/vibe-console/.env.local

# NextAuth Configuration
# ----------------------
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# GitHub OAuth App
# ----------------
# Create your OAuth app at: https://github.com/settings/developers
# - Set "Homepage URL" to: http://localhost:3000
# - Set "Authorization callback URL" to: http://localhost:3000/api/auth/callback/github
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Access Control
# --------------
# Comma-separated list of emails allowed to use the app
# Leave empty to allow anyone who can authenticate
ALLOWED_EMAILS=

# Preview Configuration
# ---------------------
NEXT_PUBLIC_PREVIEW_URL=http://localhost:3001
`;

            const { filePath } = await dialog.showSaveDialog({
              title: "Save Environment Template",
              defaultPath: "env.local.template.txt",
              filters: [
                { name: "Text Files", extensions: ["txt"] },
                { name: "All Files", extensions: ["*"] },
              ],
            });

            if (filePath) {
              fs.writeFileSync(filePath, template, "utf-8");
              shell.showItemInFolder(filePath);
            }
          },
        },
        {
          label: "Open Data Folder",
          click: () => {
            shell.openPath(app.getPath("userData"));
          },
        },
        { type: "separator" },
        {
          label: "Check for Updates...",
          enabled: !!autoUpdater,
          click: () => {
            if (autoUpdater) autoUpdater.checkForUpdatesAndNotify();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { buildMenu };

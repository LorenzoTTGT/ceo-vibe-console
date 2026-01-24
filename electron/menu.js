const { app, Menu, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");

function buildMenu() {
  const isMac = process.platform === "darwin";

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
          label: "Check for Updates...",
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { buildMenu };

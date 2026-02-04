const { dialog, shell } = require("electron");
const { execSync } = require("child_process");

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

/**
 * Cross-platform command detection
 */
function isInstalled(cmd) {
  try {
    // Use 'where' on Windows, 'which' on Unix
    const checkCmd = isWindows ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get installation instructions for each CLI
 */
function getCodexInstallInfo() {
  return {
    name: "OpenAI Codex CLI",
    command: "npm install -g @openai/codex",
    description: "Required for AI-powered code changes",
    url: "https://github.com/openai/codex",
  };
}

function getGhInstallInfo() {
  if (isMac) {
    return {
      name: "GitHub CLI",
      command: "brew install gh",
      description: "Used for repository operations",
      url: "https://cli.github.com/",
      altInstructions: "Or download from: https://cli.github.com/",
    };
  } else if (isWindows) {
    return {
      name: "GitHub CLI",
      command: "winget install --id GitHub.cli -e",
      description: "Used for repository operations",
      url: "https://cli.github.com/",
      altInstructions: "Or download the installer from: https://cli.github.com/",
    };
  } else {
    return {
      name: "GitHub CLI",
      command: "sudo apt install -y gh",
      description: "Used for repository operations",
      url: "https://cli.github.com/",
      altInstructions: "See https://github.com/cli/cli/blob/trunk/docs/install_linux.md",
    };
  }
}

/**
 * Show instructions dialog instead of auto-installing
 * This is safer across platforms and doesn't require TTY/admin
 */
async function showInstallInstructions(info) {
  const detail = [
    info.description,
    "",
    "To install, open a terminal and run:",
    `  ${info.command}`,
    "",
    info.altInstructions || "",
  ].filter(Boolean).join("\n");

  const { response } = await dialog.showMessageBox({
    type: "info",
    buttons: ["Open Download Page", "Copy Command", "Skip"],
    defaultId: 0,
    title: `${info.name} Not Found`,
    message: `${info.name} is not installed.`,
    detail,
  });

  if (response === 0) {
    // Open download page
    shell.openExternal(info.url);
  } else if (response === 1) {
    // Copy command to clipboard
    const { clipboard } = require("electron");
    clipboard.writeText(info.command);
    dialog.showMessageBox({
      type: "info",
      buttons: ["OK"],
      title: "Command Copied",
      message: "Installation command copied to clipboard.",
      detail: `Paste it in your terminal:\n${info.command}`,
    });
  }
}

/**
 * Check for required CLIs and show instructions if missing
 */
async function installCLIs() {
  const missing = [];

  // Check for Codex CLI
  if (!isInstalled("codex")) {
    missing.push(getCodexInstallInfo());
  }

  // Check for GitHub CLI
  if (!isInstalled("gh")) {
    missing.push(getGhInstallInfo());
  }

  // Show instructions for each missing CLI
  for (const info of missing) {
    await showInstallInstructions(info);
  }

  // Return whether all CLIs are installed
  return missing.length === 0;
}

module.exports = { installCLIs, isInstalled };

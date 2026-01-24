const { dialog } = require("electron");
const { execSync } = require("child_process");

function isInstalled(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runInstall(command, name) {
  try {
    execSync(command, { stdio: "inherit", timeout: 120000 });
    return true;
  } catch (err) {
    dialog.showErrorBox(
      `Failed to install ${name}`,
      `Command failed: ${command}\n\n${err.message}\n\nYou can install it manually and restart the app.`
    );
    return false;
  }
}

function getGhInstallCommand() {
  switch (process.platform) {
    case "darwin":
      return "brew install gh";
    case "win32":
      return "winget install --id GitHub.cli -e";
    default:
      return "sudo apt install -y gh";
  }
}

async function installCLIs() {
  // Check for Codex CLI
  if (!isInstalled("codex")) {
    const { response } = await dialog.showMessageBox({
      type: "question",
      buttons: ["Install", "Skip"],
      defaultId: 0,
      title: "Codex CLI Not Found",
      message: "The OpenAI Codex CLI is not installed.",
      detail:
        "Codex CLI is required for AI-powered code changes. Install it now via npm?\n\nCommand: npm install -g @openai/codex",
    });

    if (response === 0) {
      runInstall("npm install -g @openai/codex", "Codex CLI");
    }
  }

  // Check for GitHub CLI
  if (!isInstalled("gh")) {
    const installCmd = getGhInstallCommand();
    const { response } = await dialog.showMessageBox({
      type: "question",
      buttons: ["Install", "Skip"],
      defaultId: 0,
      title: "GitHub CLI Not Found",
      message: "The GitHub CLI (gh) is not installed.",
      detail: `GitHub CLI is used for repository operations. Install it now?\n\nCommand: ${installCmd}`,
    });

    if (response === 0) {
      runInstall(installCmd, "GitHub CLI");
    }
  }
}

module.exports = { installCLIs };

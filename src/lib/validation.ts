import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

export const execFileAsync = promisify(execFile);

const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

/** Only alphanumeric, hyphens, underscores, dots */
export function validateRepoName(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

/** Valid git ref characters (no .., no control chars, no spaces, no ~^:?\[) */
export function validateBranchName(name: string): boolean {
  if (!name || name.length > 250) return false;
  if (/\.\./.test(name)) return false;
  if (/[~^:?*\[\]\\@{}\s]/.test(name)) return false;
  if (name.startsWith("/") || name.endsWith("/") || name.endsWith(".")) return false;
  if (name.endsWith(".lock")) return false;
  return /^[a-zA-Z0-9/_.-]+$/.test(name);
}

/** Hex only, 4-40 chars */
export function validateCommitSha(sha: string): boolean {
  return /^[0-9a-fA-F]{4,40}$/.test(sha);
}

/** Whitelist of allowed Codex models */
const ALLOWED_MODELS = [
  "gpt-5.2-codex",
  "gpt-5.1-codex-mini",
  "gpt-5.1-codex-max",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5.1-codex",
  "gpt-5-codex",
  "gpt-5-codex-mini",
  "gpt-5",
  "codex-1",
  "codex-mini-latest",
  "o3",
  "o4-mini",
];

export function validateModel(model: string): boolean {
  return ALLOWED_MODELS.includes(model);
}

/** Validates name + prevents path traversal, returns absolute path */
export function getSafeRepoPath(repoName: string): string | null {
  if (!validateRepoName(repoName)) return null;
  const resolved = path.resolve(WORKSPACE_PATH, repoName);
  const workspaceResolved = path.resolve(WORKSPACE_PATH);
  if (!resolved.startsWith(workspaceResolved + path.sep)) return null;
  return resolved;
}

/** Wraps execFile("git", ["-C", repoPath, ...args]) - no shell */
export async function safeGit(
  repoPath: string,
  args: string[],
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync(
    "git",
    ["-C", repoPath, ...args],
    { timeout: options.timeout || 30000, maxBuffer: 10 * 1024 * 1024 }
  );
  return { stdout, stderr };
}

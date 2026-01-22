"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  GitPullRequest,
  GitCommit,
  GitMerge,
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  RotateCcw,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  description: string | null;
  updatedAt: string;
}

interface Branch {
  name: string;
  isDefault: boolean;
  isProtected: boolean;
  isVibe: boolean;
}

interface Commit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface GitHubPR {
  number: number;
  title: string;
  url: string;
  branch: string;
  state: "open" | "closed";
  merged: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VersionControlPanelProps {
  selectedRepo: Repo | null;
  hasChanges: boolean;
  changedFiles: string[];
  onCreatePR: (message: string) => Promise<{ success: boolean; prUrl?: string; error?: string; branch?: string }>;
  onRefreshPreview?: () => void;
}

type TabType = "branches" | "commits" | "prs";

export function VersionControlPanel({
  selectedRepo,
  hasChanges,
  changedFiles,
  onCreatePR,
  onRefreshPreview,
}: VersionControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("branches");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [prs, setPRs] = useState<GitHubPR[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; prUrl?: string; error?: string } | null>(null);

  // Fetch branches and commits from GitHub
  const fetchBranchesAndCommits = useCallback(async () => {
    if (!selectedRepo) return;

    setIsLoading(true);

    // Timeout after 10 seconds
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(
        `/api/github/branches?owner=${selectedRepo.owner}&repo=${selectedRepo.name}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      const data = await res.json();
      if (data.error) {
        console.error("API error:", data.error);
      } else {
        if (data.branches) {
          setBranches(data.branches);
        }
        if (data.commits) {
          setCommits(data.commits);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.error("Fetch branches timed out");
      } else {
        console.error("Failed to fetch branches:", e);
      }
    }
    setIsLoading(false);
  }, [selectedRepo]);

  // Fetch PRs from GitHub
  const fetchPRs = useCallback(async () => {
    if (!selectedRepo) return;

    try {
      const res = await fetch(
        `/api/github/recent-prs?owner=${selectedRepo.owner}&repo=${selectedRepo.name}`
      );
      const data = await res.json();
      if (data.prs) {
        setPRs(data.prs);
      }
    } catch (e) {
      console.error("Failed to fetch PRs:", e);
    }
  }, [selectedRepo]);

  // Fetch current branch
  const fetchCurrentBranch = useCallback(async () => {
    if (!selectedRepo) return;

    try {
      const res = await fetch(`/api/sandbox/checkout?repo=${selectedRepo.name}`);
      const data = await res.json();
      if (data.currentBranch) {
        setCurrentBranch(data.currentBranch);
      }
    } catch (e) {
      console.error("Failed to fetch current branch:", e);
    }
  }, [selectedRepo]);

  // Load data when repo changes
  useEffect(() => {
    if (selectedRepo) {
      // Reset state when repo changes
      setBranches([]);
      setCommits([]);
      setPRs([]);
      setCurrentBranch(null);

      // Fetch all data
      fetchBranchesAndCommits();
      fetchPRs();
      fetchCurrentBranch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo?.name]);

  // Checkout a branch
  const checkoutBranch = async (branch: string) => {
    if (!selectedRepo || isCheckingOut) return;

    setIsCheckingOut(branch);
    try {
      const res = await fetch("/api/sandbox/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName: selectedRepo.name, branch }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentBranch(data.currentBranch);
        // Refresh the preview iframe instead of the whole page
        onRefreshPreview?.();
      } else {
        alert(`Checkout failed: ${data.error}`);
      }
    } catch (e) {
      console.error("Checkout failed:", e);
      alert("Failed to checkout branch");
    } finally {
      setIsCheckingOut(null);
    }
  };

  // Checkout a commit
  const checkoutCommit = async (sha: string) => {
    if (!selectedRepo || isCheckingOut) return;

    setIsCheckingOut(sha);
    try {
      const res = await fetch("/api/sandbox/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName: selectedRepo.name, commit: sha }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentBranch(data.currentBranch);
        // Refresh the preview iframe instead of the whole page
        onRefreshPreview?.();
      } else {
        alert(`Checkout failed: ${data.error}`);
      }
    } catch (e) {
      console.error("Checkout failed:", e);
      alert("Failed to checkout commit");
    } finally {
      setIsCheckingOut(null);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (!commitMessage.trim() || !selectedRepo) return;

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const result = await onCreatePR(commitMessage);
      setPublishResult(result);
      if (result.success && result.prUrl) {
        setCommitMessage("");
        setTimeout(() => {
          fetchPRs();
          fetchBranchesAndCommits();
        }, 1000);
      }
    } catch (error) {
      setPublishResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (!selectedRepo) {
    return null;
  }

  // PR Status Badge
  const PRStatusBadge = ({ pr }: { pr: GitHubPR }) => {
    if (pr.merged) {
      return (
        <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
          <GitMerge className="w-3 h-3" />
          Merged
        </span>
      );
    }
    if (pr.state === "open") {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
          <GitPullRequest className="w-3 h-3" />
          Open
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
        <AlertCircle className="w-3 h-3" />
        Closed
      </span>
    );
  };

  return (
    <div className={cn(
      "bg-gray-800/50 rounded-lg border overflow-hidden transition-all",
      hasChanges ? "border-emerald-600/30" : "border-gray-700"
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
          <GitBranch className={cn("w-4 h-4", hasChanges ? "text-emerald-500" : "text-gray-500")} />
          <span className={cn("text-sm font-medium", hasChanges ? "text-white" : "text-gray-400")}>
            Version Control
          </span>
          {hasChanges && (
            <span className="text-xs text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
              {changedFiles.length} change{changedFiles.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {currentBranch && (
          <code className="text-xs text-gray-400 truncate max-w-[120px]">{currentBranch}</code>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-700/50">
          {/* Current branch indicator */}
          {currentBranch && (
            <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-700/50 flex items-center gap-2">
              <Eye className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-gray-400">Viewing:</span>
              <code className="text-xs text-emerald-300 truncate flex-1">{currentBranch}</code>
              {currentBranch !== selectedRepo.defaultBranch && (
                <button
                  onClick={() => checkoutBranch(selectedRepo.defaultBranch)}
                  disabled={!!isCheckingOut}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700"
                  title={`Back to ${selectedRepo.defaultBranch}`}
                >
                  <RotateCcw className={cn("w-3 h-3", isCheckingOut && "animate-spin")} />
                  Reset
                </button>
              )}
            </div>
          )}

          {/* Publish section - only if there are changes */}
          {hasChanges && (
            <div className="p-3 border-b border-gray-700/50 bg-emerald-500/5">
              <div className="mb-2">
                <h4 className="text-xs font-medium text-gray-400 mb-1">
                  Changed files ({changedFiles.length})
                </h4>
                <div className="max-h-20 overflow-y-auto space-y-1">
                  {changedFiles.map((file) => (
                    <div key={file} className="text-xs text-gray-300 font-mono bg-gray-900 px-2 py-1 rounded truncate">
                      {file}
                    </div>
                  ))}
                </div>
              </div>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe your changes..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none mb-2"
                rows={2}
              />
              {publishResult && (
                <div
                  className={cn(
                    "mb-2 p-2 rounded text-sm",
                    publishResult.success
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  )}
                >
                  {publishResult.success ? (
                    <>
                      PR created!{" "}
                      {publishResult.prUrl && (
                        <a href={publishResult.prUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          View
                        </a>
                      )}
                    </>
                  ) : (
                    publishResult.error
                  )}
                </div>
              )}
              <button
                onClick={handlePublish}
                disabled={!commitMessage.trim() || isPublishing}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors text-sm",
                  commitMessage.trim() && !isPublishing
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating PR...
                  </>
                ) : (
                  <>
                    <GitPullRequest className="w-4 h-4" />
                    Create Pull Request
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-700/50">
            {(["branches", "commits", "prs"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === tab
                    ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                {tab === "branches" && <GitBranch className="w-3 h-3 inline mr-1" />}
                {tab === "commits" && <GitCommit className="w-3 h-3 inline mr-1" />}
                {tab === "prs" && <GitPullRequest className="w-3 h-3 inline mr-1" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "branches" && branches.length > 0 && ` (${branches.length})`}
                {tab === "prs" && prs.length > 0 && ` (${prs.length})`}
              </button>
            ))}
            <button
              onClick={() => {
                fetchBranchesAndCommits();
                fetchPRs();
              }}
              className="px-2 text-gray-500 hover:text-gray-300"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
            </button>
          </div>

          {/* Tab content - scrollable */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            ) : (
              <>
                {/* Branches tab */}
                {activeTab === "branches" && (
                  <div className="p-2 space-y-1">
                    {branches.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">No branches found</p>
                    ) : (
                      branches.map((branch) => {
                        const isCurrentBranch = currentBranch === branch.name;
                        const isCheckingOutThis = isCheckingOut === branch.name;

                        return (
                          <div
                            key={branch.name}
                            className={cn(
                              "flex items-center justify-between p-2 rounded transition-colors",
                              isCurrentBranch ? "bg-emerald-500/10 ring-1 ring-emerald-500/30" : "hover:bg-gray-700/30"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <GitBranch className={cn(
                                "w-3.5 h-3.5 flex-shrink-0",
                                branch.isDefault ? "text-yellow-400" : branch.isVibe ? "text-emerald-400" : "text-gray-500"
                              )} />
                              <span className={cn(
                                "text-sm truncate",
                                isCurrentBranch ? "text-emerald-300" : "text-gray-300"
                              )}>
                                {branch.name}
                              </span>
                              {branch.isDefault && (
                                <span className="text-xs text-yellow-400 bg-yellow-500/20 px-1 py-0.5 rounded flex-shrink-0">
                                  default
                                </span>
                              )}
                              {isCurrentBranch && (
                                <span className="text-xs text-emerald-400 flex items-center gap-1 flex-shrink-0">
                                  <Eye className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            {!isCurrentBranch && (
                              <button
                                onClick={() => checkoutBranch(branch.name)}
                                disabled={!!isCheckingOut}
                                className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors flex-shrink-0"
                                title="Preview this branch"
                              >
                                {isCheckingOutThis ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Commits tab */}
                {activeTab === "commits" && (
                  <div className="p-2 space-y-1">
                    {commits.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">No commits found</p>
                    ) : (
                      commits.map((commit) => {
                        const isCheckingOutThis = isCheckingOut === commit.sha;

                        return (
                          <div
                            key={commit.sha}
                            className="flex items-start gap-2 p-2 rounded hover:bg-gray-700/30 transition-colors"
                          >
                            <GitCommit className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-300 truncate">{commit.message}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <code className="text-emerald-400">{commit.shortSha}</code>
                                <span>{commit.author}</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(commit.date).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => checkoutCommit(commit.sha)}
                                disabled={!!isCheckingOut}
                                className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                                title="Preview this commit"
                              >
                                {isCheckingOutThis ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <a
                                href={commit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                title="View on GitHub"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* PRs tab */}
                {activeTab === "prs" && (
                  <div className="p-2 space-y-1">
                    {prs.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">No pull requests found</p>
                    ) : (
                      prs.map((pr) => {
                        const isCurrentBranch = currentBranch === pr.branch;
                        const isCheckingOutThis = isCheckingOut === pr.branch;

                        return (
                          <div
                            key={pr.number}
                            className={cn(
                              "p-2 rounded transition-colors",
                              isCurrentBranch ? "bg-emerald-500/10 ring-1 ring-emerald-500/30" : "hover:bg-gray-700/30"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-gray-500">#{pr.number}</span>
                                  <PRStatusBadge pr={pr} />
                                  {isCurrentBranch && (
                                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                                      <Eye className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-white truncate">{pr.title}</p>
                                <p className="text-xs text-gray-500 truncate">{pr.branch}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!isCurrentBranch && (
                                  <button
                                    onClick={() => checkoutBranch(pr.branch)}
                                    disabled={!!isCheckingOut}
                                    className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                                    title="Preview this branch"
                                  >
                                    {isCheckingOutThis ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                                <a
                                  href={pr.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                                  title="Open on GitHub"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { GitBranch, GitPullRequest, Loader2, Check, AlertCircle, ChevronDown, ChevronRight, ExternalLink, History, GitMerge, Clock, Eye, RotateCcw } from "lucide-react";
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

interface PublishPanelProps {
  hasChanges: boolean;
  changedFiles: string[];
  onCreatePR: (message: string) => Promise<{ success: boolean; prUrl?: string; error?: string; branch?: string }>;
  selectedRepo: Repo | null;
}

export function PublishPanel({ hasChanges, changedFiles, onCreatePR, selectedRepo }: PublishPanelProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; prUrl?: string; error?: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recentPRs, setRecentPRs] = useState<GitHubPR[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingPRs, setIsLoadingPRs] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);

  // Fetch recent PRs from GitHub
  const fetchRecentPRs = useCallback(async () => {
    if (!selectedRepo) return;

    setIsLoadingPRs(true);
    try {
      const res = await fetch(`/api/github/recent-prs?owner=${selectedRepo.owner}&repo=${selectedRepo.name}`);
      const data = await res.json();
      if (data.prs) {
        setRecentPRs(data.prs);
      }
    } catch (e) {
      console.error("Failed to fetch recent PRs:", e);
    } finally {
      setIsLoadingPRs(false);
    }
  }, [selectedRepo]);

  // Fetch current branch info
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
        // Trigger a page refresh to reload the preview
        window.location.reload();
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

  // Load recent PRs and current branch when repo changes
  useEffect(() => {
    if (selectedRepo) {
      fetchRecentPRs();
      fetchCurrentBranch();
    }
  }, [selectedRepo, fetchRecentPRs, fetchCurrentBranch]);

  const handlePublish = async () => {
    if (!commitMessage.trim() || !selectedRepo) return;

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const result = await onCreatePR(commitMessage);
      setPublishResult(result);
      if (result.success && result.prUrl) {
        setCommitMessage("");
        // Refresh PR list after creating
        setTimeout(() => fetchRecentPRs(), 1000);
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

  // Helper to render PR status badge
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

  // Show collapsed "no changes" state when no changes, but allow viewing history
  if (!hasChanges) {
    return (
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
        >
          <div className="flex items-center gap-2 opacity-60">
            <GitBranch className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-400">Publish Changes</span>
            <span className="text-xs text-gray-500">No changes</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingPRs && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
            {recentPRs.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <History className="w-3 h-3" />
                <span>{recentPRs.length} PRs</span>
              </div>
            )}
          </div>
        </button>
        {showHistory && (
          <div className="border-t border-gray-700/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-400 flex items-center gap-1">
                <History className="w-3 h-3" />
                Recent Pull Requests
              </h4>
              <button
                onClick={(e) => { e.stopPropagation(); fetchRecentPRs(); }}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Refresh
              </button>
            </div>
            {/* Current branch indicator */}
            {currentBranch && (
              <div className="mb-3 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center gap-2">
                <Eye className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400">Viewing:</span>
                <code className="text-xs text-emerald-300 truncate flex-1">{currentBranch}</code>
                {currentBranch !== selectedRepo?.defaultBranch && (
                  <button
                    onClick={() => checkoutBranch(selectedRepo?.defaultBranch || "main")}
                    disabled={!!isCheckingOut}
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                    title={`Switch back to ${selectedRepo?.defaultBranch}`}
                  >
                    <RotateCcw className={cn("w-3 h-3", isCheckingOut && "animate-spin")} />
                  </button>
                )}
              </div>
            )}
            {isLoadingPRs ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              </div>
            ) : recentPRs.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2">No recent PRs found</p>
            ) : (
              <div className="space-y-2">
                {recentPRs.map((pr) => {
                  const isCurrentBranch = currentBranch === pr.branch;
                  const isCheckingOutThis = isCheckingOut === pr.branch;

                  return (
                    <div
                      key={pr.number}
                      className={cn(
                        "p-2 bg-gray-900 rounded transition-colors",
                        isCurrentBranch && "ring-1 ring-emerald-500/50"
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
                                viewing
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
                              className="p-1 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
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
                            className="p-1 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                            title="Open on GitHub"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(pr.createdAt).toLocaleDateString()} {new Date(pr.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg border border-emerald-600/30 overflow-hidden">
      {/* Collapsible header */}
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
          <GitBranch className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-white">Publish Changes</span>
          <span className="text-xs text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
            {changedFiles.length} file{changedFiles.length !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="p-4 pt-2 border-t border-gray-700/50">
          {/* Changed files */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-400 mb-2">Changed files ({changedFiles.length})</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {changedFiles.map((file) => (
                <div key={file} className="text-xs text-gray-300 font-mono bg-gray-900 px-2 py-1 rounded">
                  {file}
                </div>
              ))}
            </div>
          </div>

          {/* Commit message */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Commit message
            </label>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe your changes..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
              rows={2}
            />
          </div>

          {/* Result message */}
          {publishResult && (
            <div
              className={cn(
                "mb-4 p-3 rounded-lg",
                publishResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              )}
            >
              {publishResult.success ? (
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm text-emerald-400">
                    PR created!{" "}
                    {publishResult.prUrl && (
                      <a
                        href={publishResult.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-emerald-300"
                      >
                        View on GitHub
                      </a>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-400">{publishResult.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={!commitMessage.trim() || isPublishing}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors",
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

          <p className="text-xs text-gray-500 mt-2 text-center">
            Creates branch <code className="text-emerald-400">vibe/{new Date().toISOString().slice(0,10)}-...</code> with PR to merge into <code className="text-gray-400">{selectedRepo.defaultBranch}</code>
          </p>

          {/* Recent PRs history */}
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mb-2"
            >
              <History className="w-3 h-3" />
              Recent PRs {recentPRs.length > 0 && `(${recentPRs.length})`}
              {isLoadingPRs && <Loader2 className="w-3 h-3 animate-spin" />}
              {showHistory ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {showHistory && (
              <div className="space-y-2">
                {isLoadingPRs ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  </div>
                ) : recentPRs.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">No recent PRs</p>
                ) : (
                  recentPRs.map((pr) => (
                    <a
                      key={pr.number}
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 bg-gray-900 rounded hover:bg-gray-800 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-500">#{pr.number}</span>
                            <PRStatusBadge pr={pr} />
                          </div>
                          <p className="text-sm text-white truncate group-hover:text-emerald-400">{pr.title}</p>
                          <p className="text-xs text-gray-500 truncate">{pr.branch}</p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-emerald-400 flex-shrink-0 mt-1" />
                      </div>
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trash2, FolderOpen, Settings, Loader2, AlertTriangle, HardDrive, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClonedRepo {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  lastUsedAt: string | null;
}

interface RepoManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRepo: (repo: ClonedRepo) => void;
  onOpenEnvSettings: (repoName: string) => void;
}

export function RepoManagerModal({ isOpen, onClose, onSelectRepo, onOpenEnvSettings }: RepoManagerModalProps) {
  const [repos, setRepos] = useState<ClonedRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingRepo, setDeletingRepo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/sandbox/repos");
      const data = await res.json();
      setRepos(data.repos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchRepos();
    }
  }, [isOpen, fetchRepos]);

  const handleDelete = async (repoName: string) => {
    if (!confirm(`Delete "${repoName}"?\n\nThis will remove:\n- Cloned files\n- Saved environment variables`)) {
      return;
    }

    setDeletingRepo(repoName);
    setError(null);

    try {
      const res = await fetch("/api/sandbox/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to delete");
      }

      // Remove from local state
      setRepos((prev) => prev.filter((r) => r.name !== repoName));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingRepo(null);
    }
  };

  const handleSelect = (repo: ClonedRepo) => {
    onSelectRepo(repo);
    onClose();
  };

  const formatLastUsed = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-medium text-white">Manage Repositories</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchRepos}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-2 mb-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : repos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No repositories cloned yet</p>
              <p className="text-xs mt-1">Select a repo from the dropdown to clone it</p>
            </div>
          ) : (
            <div className="space-y-2">
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center gap-2 p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{repo.fullName}</div>
                    <div className="text-xs text-gray-500">
                      Last used: {formatLastUsed(repo.lastUsedAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSelect(repo)}
                      className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-700 rounded transition-colors"
                      title="Open repository"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onOpenEnvSettings(repo.name)}
                      className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                      title="Environment variables"
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(repo.name)}
                      disabled={deletingRepo === repo.name}
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        deletingRepo === repo.name
                          ? "text-gray-600 cursor-wait"
                          : "text-gray-400 hover:text-red-400 hover:bg-gray-700"
                      )}
                      title="Delete repository"
                    >
                      {deletingRepo === repo.name ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {repos.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-800 bg-gray-800/30">
            <p className="text-xs text-gray-500 text-center">
              {repos.length} repo{repos.length !== 1 ? "s" : ""} cloned
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

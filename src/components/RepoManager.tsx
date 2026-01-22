"use client";

import { useState } from "react";
import { Trash2, FolderOpen, Settings, Loader2, AlertTriangle, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClonedRepo {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  lastUsedAt: string | null;
}

interface RepoManagerProps {
  repos: ClonedRepo[];
  onSelectRepo: (repo: ClonedRepo) => void;
  onDeleteRepo: (repoName: string) => Promise<void>;
  onOpenEnvSettings: (repoName: string) => void;
  onRefresh: () => void;
}

export function RepoManager({ repos, onSelectRepo, onDeleteRepo, onOpenEnvSettings, onRefresh }: RepoManagerProps) {
  const [deletingRepo, setDeletingRepo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (repoName: string) => {
    if (!confirm(`Delete "${repoName}"? This will remove the cloned files and saved env vars.`)) {
      return;
    }

    setDeletingRepo(repoName);
    setError(null);

    try {
      await onDeleteRepo(repoName);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingRepo(null);
    }
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

  if (repos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No repositories cloned yet</p>
        <p className="text-xs mt-1">Select a repo from the dropdown to clone it</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

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
              onClick={() => onSelectRepo(repo)}
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

      <p className="text-xs text-gray-600 text-center pt-2">
        {repos.length} repo{repos.length !== 1 ? "s" : ""} cloned
      </p>
    </div>
  );
}

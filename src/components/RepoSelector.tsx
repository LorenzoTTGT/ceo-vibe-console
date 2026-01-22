"use client";

import { useState, useEffect } from "react";
import {
  GitBranch,
  ChevronDown,
  Lock,
  Globe,
  Loader2,
  AlertTriangle,
  Check,
  Download,
  Clock,
  Settings,
  Search,
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

interface ClonedRepo {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  defaultBranch: string;
  lastUsedAt: string | null;
}

interface RepoSelectorProps {
  selectedRepo: Repo | null;
  onSelectRepo: (repo: Repo | null) => void;
  onRepoReady?: (ready: boolean) => void;
  onOpenEnvSettings?: (repoName: string) => void;
}

type SetupStatus = "idle" | "cloning" | "installing" | "starting" | "ready" | "error";

export function RepoSelector({ selectedRepo, onSelectRepo, onRepoReady, onOpenEnvSettings }: RepoSelectorProps) {
  const [githubRepos, setGithubRepos] = useState<Repo[]>([]);
  const [clonedRepos, setClonedRepos] = useState<ClonedRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus>("idle");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [cloneProgress, setCloneProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch both GitHub repos and locally cloned repos
  useEffect(() => {
    async function fetchRepos() {
      try {
        const [githubRes, clonedRes] = await Promise.all([
          fetch("/api/github/repos"),
          fetch("/api/sandbox/repos"),
        ]);

        const githubData = await githubRes.json();
        const clonedData = await clonedRes.json();

        if (githubData.error) {
          setError(githubData.error);
        } else {
          setGithubRepos(githubData.repos || []);
        }

        setClonedRepos(clonedData.repos || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch repos");
      } finally {
        setIsLoading(false);
      }
    }

    fetchRepos();
  }, []);

  const isCloned = (repoName: string) => {
    return clonedRepos.some((r) => r.name === repoName);
  };

  // Filter repos based on search query
  const filteredGithubRepos = githubRepos.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredClonedRepos = clonedRepos.filter((repo) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const setupRepo = async (repo: Repo, needsClone: boolean) => {
    setSetupError(null);
    onRepoReady?.(false);

    if (needsClone) {
      // Step 1: Clone
      setSetupStatus("cloning");
      setCloneProgress(0);

      const progressInterval = setInterval(() => {
        setCloneProgress((p) => Math.min(p + Math.random() * 10, 45));
      }, 500);

      try {
        const cloneRes = await fetch("/api/sandbox/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoOwner: repo.owner,
            repoName: repo.name,
            fullName: repo.fullName,
            defaultBranch: repo.defaultBranch,
            step: "clone",
          }),
        });
        const cloneData = await cloneRes.json();

        clearInterval(progressInterval);

        if (!cloneData.success) {
          throw new Error(cloneData.error || "Failed to clone");
        }

        setCloneProgress(50);
      } catch (err) {
        clearInterval(progressInterval);
        setSetupStatus("error");
        setSetupError(err instanceof Error ? err.message : "Clone failed");
        return;
      }

      // Step 2: Install dependencies
      setSetupStatus("installing");

      const installProgressInterval = setInterval(() => {
        setCloneProgress((p) => Math.min(p + Math.random() * 8, 95));
      }, 500);

      try {
        const installRes = await fetch("/api/sandbox/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoOwner: repo.owner,
            repoName: repo.name,
            step: "install",
          }),
        });
        const installData = await installRes.json();

        clearInterval(installProgressInterval);

        if (!installData.success) {
          throw new Error(installData.error || "Failed to install dependencies");
        }

        setCloneProgress(100);

        // Update cloned repos list
        setClonedRepos((prev) => [
          ...prev.filter((r) => r.name !== repo.name),
          {
            id: 0, // Will be set correctly on next fetch
            name: repo.name,
            owner: repo.owner,
            fullName: repo.fullName,
            defaultBranch: repo.defaultBranch,
            lastUsedAt: null,
          },
        ]);
      } catch (err) {
        clearInterval(installProgressInterval);
        setSetupStatus("error");
        setSetupError(err instanceof Error ? err.message : "Install failed");
        return;
      }
    }

    // Mark as used
    await fetch("/api/sandbox/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoName: repo.name, markUsed: true }),
    });

    // Start dev server
    setSetupStatus("starting");
    try {
      const devRes = await fetch("/api/sandbox/dev-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName: repo.name }),
      });
      const devData = await devRes.json();

      if (!devData.success) {
        throw new Error(devData.error || "Failed to start dev server");
      }
    } catch (err) {
      setSetupStatus("error");
      setSetupError(err instanceof Error ? err.message : "Dev server failed");
      return;
    }

    setSetupStatus("ready");
    onRepoReady?.(true);
  };

  const handleSelectRepo = async (repo: Repo) => {
    const needsClone = !isCloned(repo.name);
    onSelectRepo(repo);
    setIsOpen(false);
    setSearchQuery("");
    await setupRepo(repo, needsClone);
  };

  const handleCloseDropdown = () => {
    setIsOpen(false);
    setSearchQuery("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading repositories...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm py-2">
        <AlertTriangle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  const isBusy = setupStatus === "cloning" || setupStatus === "installing" || setupStatus === "starting";

  return (
    <div className="space-y-3">
      {/* Dropdown */}
      <div className="relative">
        <button
          onClick={() => !isBusy && setIsOpen(!isOpen)}
          disabled={isBusy}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors text-left",
            selectedRepo
              ? "bg-gray-800 border-gray-700 hover:border-gray-600"
              : "bg-gray-800/50 border-dashed border-gray-600 hover:border-gray-500",
            isBusy && "opacity-60 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="w-4 h-4 text-emerald-500 shrink-0" />
            {selectedRepo ? (
              <span className="text-sm text-white truncate">{selectedRepo.fullName}</span>
            ) : (
              <span className="text-sm text-gray-400">Select a repository...</span>
            )}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform shrink-0", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={handleCloseDropdown} />
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 max-h-96 overflow-hidden flex flex-col">
              {/* Search input */}
              <div className="p-2 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
                    autoFocus
                  />
                </div>
              </div>

              <div className="overflow-y-auto flex-1">
              {/* Cloned repos section */}
              {filteredClonedRepos.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-900/50">
                    Recently Used
                  </div>
                  {filteredClonedRepos.map((cloned) => {
                    // Build a Repo object from cloned data
                    const repoForSelect: Repo = {
                      id: cloned.id,
                      name: cloned.name,
                      owner: cloned.owner,
                      fullName: cloned.fullName,
                      defaultBranch: cloned.defaultBranch,
                      private: false, // We don't store this, default to false
                      description: null,
                      updatedAt: cloned.lastUsedAt || "",
                    };

                    return (
                      <div
                        key={cloned.name}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 hover:bg-gray-700/50 transition-colors",
                          selectedRepo?.name === cloned.name && "bg-emerald-500/10"
                        )}
                      >
                        <button
                          onClick={() => handleSelectRepo(repoForSelect)}
                          className="flex-1 flex items-center gap-2 text-left min-w-0"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-sm text-white truncate">{cloned.fullName}</span>
                          {cloned.lastUsedAt && (
                            <Clock className="w-3 h-3 text-gray-600 shrink-0" />
                          )}
                        </button>
                        {onOpenEnvSettings && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenEnvSettings(cloned.name);
                            }}
                            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                            title="Environment variables"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* All repos section */}
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-900/50">
                All Repositories
              </div>
              {filteredGithubRepos.length === 0 && filteredClonedRepos.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  No repositories found
                </div>
              ) : (
                filteredGithubRepos.map((repo) => {
                  const alreadyCloned = isCloned(repo.name);
                  return (
                    <button
                      key={repo.id}
                      onClick={() => handleSelectRepo(repo)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700/50 transition-colors text-left",
                        selectedRepo?.id === repo.id && "bg-emerald-500/10"
                      )}
                    >
                      {alreadyCloned ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                      )}
                      {repo.private ? (
                        <Lock className="w-3 h-3 text-gray-500 shrink-0" />
                      ) : (
                        <Globe className="w-3 h-3 text-gray-500 shrink-0" />
                      )}
                      <span className="text-sm text-white truncate flex-1">{repo.fullName}</span>
                      {!alreadyCloned && (
                        <span className="text-xs text-gray-500">Clone</span>
                      )}
                    </button>
                  );
                })
              )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status */}
      {(setupStatus === "cloning" || setupStatus === "installing") && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-400">
              {setupStatus === "cloning" ? "Cloning repository..." : "Installing dependencies..."}
            </span>
            <span className="text-gray-500">{Math.round(cloneProgress)}%</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${cloneProgress}%` }}
            />
          </div>
        </div>
      )}

      {setupStatus === "starting" && (
        <div className="flex items-center gap-2 text-xs text-blue-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Starting dev server...
        </div>
      )}

      {setupStatus === "ready" && selectedRepo && (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <Check className="w-3 h-3" />
          Ready — changes will go to a new branch
        </div>
      )}

      {setupStatus === "error" && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3 h-3" />
          {setupError}
        </div>
      )}
    </div>
  );
}

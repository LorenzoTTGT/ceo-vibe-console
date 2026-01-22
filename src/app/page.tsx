"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { LogOut, User, HardDrive, Settings } from "lucide-react";
import { PromptPanel } from "@/components/PromptPanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { CodexStatus } from "@/components/CodexStatus";
import { VersionControlPanel } from "@/components/VersionControlPanel";
import { RepoSelector } from "@/components/RepoSelector";
import { EnvVarsModal } from "@/components/EnvVarsModal";
import { RepoManagerModal } from "@/components/RepoManagerModal";
import { DevServerLogs } from "@/components/DevServerLogs";

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

export default function Home() {
  const { data: session, status } = useSession();
  const [isCodexReady, setIsCodexReady] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [isRepoReady, setIsRepoReady] = useState(false);
  const [envModalRepo, setEnvModalRepo] = useState<string | null>(null);
  const [isRepoManagerOpen, setIsRepoManagerOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("http://localhost:3001");
  const [codexModel, setCodexModel] = useState<string>("gpt-5.2-codex");
  const [sidebarWidth, setSidebarWidth] = useState<number>(384); // 384px = w-96
  const [previewKey, setPreviewKey] = useState(0); // Used to force iframe refresh
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh preview iframe without reloading the whole page
  const refreshPreview = useCallback(() => {
    setPreviewKey(prev => prev + 1);
  }, []);

  // Handle sidebar resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      // Constrain between 280px and 600px
      const clampedWidth = Math.min(Math.max(newWidth, 280), 600);
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Fetch dev server URL when repo is ready
  const fetchDevServerUrl = useCallback(async () => {
    try {
      const res = await fetch("/api/sandbox/dev-server");
      const data = await res.json();
      if (data.url) {
        setPreviewUrl(data.url);
      }
    } catch (err) {
      console.error("Failed to fetch dev server URL:", err);
    }
  }, []);

  // Update preview URL when repo becomes ready
  useEffect(() => {
    if (isRepoReady) {
      fetchDevServerUrl();
    }
  }, [isRepoReady, fetchDevServerUrl]);

  // Check sandbox status periodically
  const checkSandboxStatus = useCallback(async () => {
    if (!selectedRepo) {
      setHasChanges(false);
      setChangedFiles([]);
      setCanUndo(false);
      return;
    }

    try {
      const response = await fetch(`/api/sandbox/status?repo=${selectedRepo.name}`);
      const data = await response.json();
      setHasChanges(data.hasChanges || false);
      setChangedFiles(data.changedFiles?.map((f: { file: string }) => f.file) || []);
      setCanUndo(data.hasChanges || false);
    } catch (error) {
      console.error("Failed to check sandbox status:", error);
    }
  }, [selectedRepo]);

  useEffect(() => {
    if (session && selectedRepo) {
      checkSandboxStatus();
      const interval = setInterval(checkSandboxStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [session, selectedRepo, checkSandboxStatus]);

  // Redirect if not authenticated
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    redirect("/login");
  }

  const handleApplyPatch = async (patch: string) => {
    if (!selectedRepo) {
      throw new Error("No repository selected");
    }

    const response = await fetch("/api/sandbox/apply-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch, repo: selectedRepo.name }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to apply patch");
    }

    // Refresh status
    await checkSandboxStatus();
  };

  const handleUndo = async () => {
    if (!selectedRepo) return;

    try {
      const response = await fetch("/api/sandbox/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: selectedRepo.name }),
      });
      const data = await response.json();
      if (data.success) {
        await checkSandboxStatus();
      }
    } catch (error) {
      console.error("Undo failed:", error);
    }
  };

  const handleCreatePR = async (message: string) => {
    if (!selectedRepo) {
      return { success: false, error: "No repository selected" };
    }

    const response = await fetch("/api/github/create-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        repoOwner: selectedRepo.owner,
        repoName: selectedRepo.name,
        targetBranch: selectedRepo.defaultBranch,
      }),
    });

    const data = await response.json();

    if (data.success) {
      await checkSandboxStatus();
    }

    return data;
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header - sticky */}
      <header className="h-14 border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0 bg-gray-900 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">Vibe Console</h1>
          <span className="px-2 py-0.5 text-xs bg-emerald-600/20 text-emerald-400 rounded-full border border-emerald-600/30">
            CEO Mode
          </span>
          {/* Current repository indicator */}
          {selectedRepo && (
            <>
              <span className="text-gray-600">|</span>
              <div className="flex items-center gap-1.5 text-sm text-gray-300">
                <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-medium">{selectedRepo.fullName}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <User className="w-4 h-4" />
            <span>{session.user?.name || session.user?.email}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content - fills remaining height, with bottom padding for footer */}
      <div ref={containerRef} className="flex-1 flex min-h-0 pb-10">
        {/* Left sidebar - Prompt & Controls - independent scroll */}
        <div
          style={{ width: sidebarWidth }}
          className="border-r border-gray-800 flex flex-col overflow-hidden flex-shrink-0"
        >
          {/* Scrollable sidebar content */}
          <div className="flex-1 overflow-y-auto">
            {/* Repo selector */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-400">Repository</label>
                <button
                  onClick={() => setIsRepoManagerOpen(true)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  title="Manage cloned repositories"
                >
                  <HardDrive className="w-3 h-3" />
                  Manage
                </button>
              </div>
              <RepoSelector
                selectedRepo={selectedRepo}
                onSelectRepo={setSelectedRepo}
                onRepoReady={setIsRepoReady}
                onOpenEnvSettings={setEnvModalRepo}
              />
              {/* Env vars button - show when repo is selected */}
              {selectedRepo && (
                <button
                  onClick={() => setEnvModalRepo(selectedRepo.name)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 text-sm transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Environment Variables
                </button>
              )}
              {/* Version control panel - collapsible, below repo selector */}
              {selectedRepo && (
                <div className="mt-3">
                  <VersionControlPanel
                    selectedRepo={selectedRepo}
                    hasChanges={hasChanges}
                    changedFiles={changedFiles}
                    onCreatePR={handleCreatePR}
                    onRefreshPreview={refreshPreview}
                  />
                </div>
              )}
            </div>

            {/* Codex status */}
            <div className="p-4 border-b border-gray-800">
              <CodexStatus
                onStatusChange={setIsCodexReady}
                onModelChange={setCodexModel}
                selectedModel={codexModel}
              />
            </div>

            {/* Prompt panel */}
            <div className="flex-1 min-h-0">
              <PromptPanel
                onApplyPatch={handleApplyPatch}
                isCodexReady={isCodexReady}
                isRepoReady={isRepoReady}
                repoName={selectedRepo?.name}
                model={codexModel}
                onUndo={handleUndo}
                canUndo={canUndo}
              />
            </div>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 hover:w-1.5 bg-gray-800 hover:bg-emerald-500/50 cursor-col-resize transition-all flex-shrink-0 active:bg-emerald-500"
        />

        {/* Right panel - Preview - independent scroll */}
        <div className="flex-1 overflow-hidden">
          <PreviewPanel previewUrl={previewUrl} refreshKey={previewKey} />
        </div>
      </div>

      {/* Env vars modal */}
      <EnvVarsModal
        repoName={envModalRepo || ""}
        isOpen={!!envModalRepo}
        onClose={() => setEnvModalRepo(null)}
      />

      {/* Repo manager modal */}
      <RepoManagerModal
        isOpen={isRepoManagerOpen}
        onClose={() => setIsRepoManagerOpen(false)}
        onSelectRepo={(repo) => {
          setSelectedRepo({
            id: repo.id,
            name: repo.name,
            owner: repo.owner,
            fullName: repo.fullName,
            defaultBranch: repo.defaultBranch,
            private: false,
            description: null,
            updatedAt: repo.lastUsedAt || "",
          });
          setIsRepoManagerOpen(false);
        }}
        onOpenEnvSettings={setEnvModalRepo}
      />

      {/* Dev server logs panel - always at bottom */}
      <DevServerLogs
        isOpen={isLogsOpen}
        onToggle={() => setIsLogsOpen(!isLogsOpen)}
        repoName={selectedRepo?.name}
      />
    </div>
  );
}

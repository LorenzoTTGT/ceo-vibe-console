"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { LogOut, User } from "lucide-react";
import { PromptPanel } from "@/components/PromptPanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { CodexStatus } from "@/components/CodexStatus";
import { PublishPanel } from "@/components/PublishPanel";

export default function Home() {
  const { data: session, status } = useSession();
  const [isCodexReady, setIsCodexReady] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const previewUrl = process.env.NEXT_PUBLIC_PREVIEW_URL || "http://localhost:3001";

  // Check sandbox status periodically
  const checkSandboxStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/sandbox/status");
      const data = await response.json();
      setHasChanges(data.hasChanges || false);
      setChangedFiles(data.changedFiles?.map((f: { file: string }) => f.file) || []);
      setCanUndo(data.hasChanges || false);
    } catch (error) {
      console.error("Failed to check sandbox status:", error);
    }
  }, []);

  useEffect(() => {
    if (session) {
      checkSandboxStatus();
      const interval = setInterval(checkSandboxStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [session, checkSandboxStatus]);

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
    const response = await fetch("/api/sandbox/apply-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to apply patch");
    }

    // Refresh status
    await checkSandboxStatus();
  };

  const handleUndo = async () => {
    try {
      const response = await fetch("/api/sandbox/undo", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        await checkSandboxStatus();
      }
    } catch (error) {
      console.error("Undo failed:", error);
    }
  };

  const handleCreatePR = async (message: string) => {
    const response = await fetch("/api/github/create-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();

    if (data.success) {
      await checkSandboxStatus();
    }

    return data;
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-gray-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">Guiido Vibe Console</h1>
          <span className="px-2 py-0.5 text-xs bg-emerald-600/20 text-emerald-400 rounded-full border border-emerald-600/30">
            CEO Mode
          </span>
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

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Left sidebar - Prompt & Controls */}
        <div className="w-96 border-r border-gray-800 flex flex-col">
          {/* Codex status */}
          <div className="p-4 border-b border-gray-800">
            <CodexStatus onStatusChange={setIsCodexReady} />
          </div>

          {/* Prompt panel */}
          <div className="flex-1 min-h-0">
            <PromptPanel
              onApplyPatch={handleApplyPatch}
              isCodexReady={isCodexReady}
              onUndo={handleUndo}
              canUndo={canUndo}
            />
          </div>

          {/* Publish panel */}
          <div className="p-4 border-t border-gray-800">
            <PublishPanel
              hasChanges={hasChanges}
              changedFiles={changedFiles}
              onCreatePR={handleCreatePR}
            />
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="flex-1">
          <PreviewPanel previewUrl={previewUrl} />
        </div>
      </div>
    </div>
  );
}

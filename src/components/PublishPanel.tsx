"use client";

import { useState } from "react";
import { GitBranch, GitPullRequest, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PublishPanelProps {
  hasChanges: boolean;
  changedFiles: string[];
  onCreatePR: (message: string) => Promise<{ success: boolean; prUrl?: string; error?: string }>;
}

export function PublishPanel({ hasChanges, changedFiles, onCreatePR }: PublishPanelProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; prUrl?: string; error?: string } | null>(null);

  const handlePublish = async () => {
    if (!commitMessage.trim()) return;

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const result = await onCreatePR(commitMessage);
      setPublishResult(result);
      if (result.success) {
        setCommitMessage("");
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

  return (
    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-5 h-5 text-emerald-500" />
        <h3 className="text-sm font-medium text-white">Publish Changes</h3>
      </div>

      {!hasChanges ? (
        <p className="text-sm text-gray-500">No changes to publish</p>
      ) : (
        <>
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
            PR will target <code className="text-emerald-400">_ceo_preview</code> branch
          </p>
        </>
      )}
    </div>
  );
}

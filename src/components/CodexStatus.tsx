"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodexStatusProps {
  onStatusChange: (isReady: boolean) => void;
}

export function CodexStatus({ onStatusChange }: CodexStatusProps) {
  const [status, setStatus] = useState<"checking" | "ready" | "not-installed" | "not-authenticated">("checking");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    checkCodexStatus();
  }, []);

  const checkCodexStatus = async () => {
    setStatus("checking");
    try {
      const response = await fetch("/api/codex/status");
      const data = await response.json();

      if (data.installed && data.authenticated) {
        setStatus("ready");
        onStatusChange(true);
      } else if (!data.installed) {
        setStatus("not-installed");
        onStatusChange(false);
      } else {
        setStatus("not-authenticated");
        onStatusChange(false);
      }
    } catch {
      setStatus("not-installed");
      onStatusChange(false);
    }
  };

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    try {
      const response = await fetch("/api/codex/auth", { method: "POST" });
      const data = await response.json();

      if (data.authUrl) {
        // Open auth URL in new window
        window.open(data.authUrl, "_blank", "width=600,height=700");

        // Poll for auth completion
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch("/api/codex/status");
          const statusData = await statusRes.json();
          if (statusData.authenticated) {
            clearInterval(pollInterval);
            setStatus("ready");
            onStatusChange(true);
            setIsAuthenticating(false);
          }
        }, 2000);

        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsAuthenticating(false);
        }, 300000);
      }
    } catch (error) {
      console.error("Auth error:", error);
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center gap-3">
        <Terminal className="w-5 h-5 text-emerald-500" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-white">OpenAI Codex</h3>
          <div className="flex items-center gap-2 mt-1">
            {status === "checking" && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Checking status...</span>
              </>
            )}
            {status === "ready" && (
              <>
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span className="text-xs text-emerald-400">Connected</span>
              </>
            )}
            {status === "not-installed" && (
              <>
                <XCircle className="w-3 h-3 text-red-500" />
                <span className="text-xs text-red-400">Not installed</span>
              </>
            )}
            {status === "not-authenticated" && (
              <>
                <XCircle className="w-3 h-3 text-yellow-500" />
                <span className="text-xs text-yellow-400">Not authenticated</span>
              </>
            )}
          </div>
        </div>

        {status === "not-authenticated" && (
          <button
            onClick={handleAuthenticate}
            disabled={isAuthenticating}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
              isAuthenticating
                ? "bg-gray-700 text-gray-400 cursor-wait"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            )}
          >
            {isAuthenticating ? "Waiting..." : "Sign in"}
          </button>
        )}

        {status === "not-installed" && (
          <div className="text-xs text-gray-500">
            Run: <code className="bg-gray-900 px-1 rounded">npm i -g @openai/codex</code>
          </div>
        )}
      </div>
    </div>
  );
}

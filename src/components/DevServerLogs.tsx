"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal, ChevronDown, ChevronUp, RefreshCw, Trash2, X, Copy, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface DevServerLogsProps {
  isOpen: boolean;
  onToggle: () => void;
  repoName?: string;
}

export function DevServerLogs({ isOpen, onToggle, repoName }: DevServerLogsProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false); // Full height mode
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const copyLogs = async () => {
    const text = logs.map(l => l.replace("[stdout] ", "").replace("[stderr] ", "")).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/sandbox/dev-server?logs=true&last=200");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const restartDevServer = async () => {
    if (!repoName) return;
    setIsRestarting(true);
    setLogs([]);
    try {
      // Stop first
      await fetch("/api/sandbox/dev-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Start again
      await fetch("/api/sandbox/dev-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName }),
      });
    } catch (err) {
      console.error("Failed to restart dev server:", err);
    } finally {
      setIsRestarting(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // Fetch logs on open and set up polling
  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  // Auto-refresh logs
  useEffect(() => {
    if (isOpen && autoRefresh) {
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, autoRefresh]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (logsEndRef.current && isOpen) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-700 transition-all duration-300 flex flex-col",
        isOpen ? (isExpanded ? "h-[70vh]" : "h-64") : "h-10"
      )}
    >
      {/* Header bar - always visible */}
      <div
        className="flex items-center justify-between px-4 h-10 shrink-0 cursor-pointer hover:bg-gray-800/50 border-b border-gray-800"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-medium text-white">Dev Server Logs</span>
          {logs.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
              {logs.length} lines
            </span>
          )}
          {logs.some(l => l.includes("[stderr]") || l.toLowerCase().includes("error")) && (
            <span className="text-xs text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
              Errors
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {isOpen && (
            <>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  autoRefresh
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "bg-gray-800 text-gray-400"
                )}
                title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              >
                Auto
              </button>
              <button
                onClick={fetchLogs}
                disabled={isLoading}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
              </button>
              <button
                onClick={copyLogs}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Copy logs"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={clearLogs}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Clear logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {repoName && (
                <button
                  onClick={restartDevServer}
                  disabled={isRestarting}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 rounded transition-colors"
                  title="Restart dev server"
                >
                  <RotateCcw className={cn("w-3 h-3", isRestarting && "animate-spin")} />
                  {isRestarting ? "Restarting..." : "Restart"}
                </button>
              )}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 text-gray-400 hover:text-white transition-colors ml-1"
            title={isOpen ? "Close" : "Open"}
          >
            {isOpen ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Logs content */}
      {isOpen && (
        <div className="flex-1 overflow-auto p-3 font-mono text-xs bg-black/30">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              No logs yet. Start a dev server to see logs here.
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((line, i) => {
                const isError = line.includes("[stderr]") || line.includes("[error]") || line.toLowerCase().includes("error");
                const isWarning = line.toLowerCase().includes("warn");
                const isExit = line.includes("[exit]");

                return (
                  <div
                    key={i}
                    className={cn(
                      "whitespace-pre-wrap break-all leading-relaxed",
                      isError && "text-red-400",
                      isWarning && !isError && "text-yellow-400",
                      isExit && "text-orange-400",
                      !isError && !isWarning && !isExit && "text-gray-300"
                    )}
                  >
                    {line.replace("[stdout] ", "").replace("[stderr] ", "")}
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

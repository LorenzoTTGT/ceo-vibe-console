"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, Terminal, ChevronDown, Copy, ExternalLink, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Available Codex models - Complete list
const CODEX_MODELS = [
  // Recommended
  { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", description: "Most advanced", category: "recommended" },
  { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini", description: "Fast & cost-effective", category: "recommended" },
  // Alternative - GPT-5.x family
  { id: "gpt-5.1-codex-max", name: "GPT-5.1 Codex Max", description: "Long-horizon tasks", category: "alternative" },
  { id: "gpt-5.2", name: "GPT-5.2", description: "General agentic", category: "alternative" },
  { id: "gpt-5.1", name: "GPT-5.1", description: "Coding & agentic", category: "alternative" },
  { id: "gpt-5.1-codex", name: "GPT-5.1 Codex", description: "Agentic coding", category: "alternative" },
  { id: "gpt-5-codex", name: "GPT-5 Codex", description: "Long-running tasks", category: "alternative" },
  { id: "gpt-5-codex-mini", name: "GPT-5 Codex Mini", description: "Cost-effective", category: "alternative" },
  { id: "gpt-5", name: "GPT-5", description: "Reasoning model", category: "alternative" },
  // Original Codex models (o-series based)
  { id: "codex-1", name: "Codex-1", description: "Based on o3", category: "original" },
  { id: "codex-mini-latest", name: "Codex Mini", description: "Based on o4-mini", category: "original" },
  // Raw reasoning models
  { id: "o3", name: "o3", description: "Reasoning model", category: "reasoning" },
  { id: "o4-mini", name: "o4-mini", description: "Fast reasoning", category: "reasoning" },
];

interface CodexStatusProps {
  onStatusChange: (isReady: boolean) => void;
  onModelChange?: (model: string) => void;
  selectedModel?: string;
}

export function CodexStatus({ onStatusChange, onModelChange, selectedModel }: CodexStatusProps) {
  const [status, setStatus] = useState<"checking" | "ready" | "not-installed" | "not-authenticated">("checking");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [deviceAuthUrl, setDeviceAuthUrl] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [rawAuthOutput, setRawAuthOutput] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showAuthHelp, setShowAuthHelp] = useState(false);
  const [codexEmail, setCodexEmail] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [model, setModel] = useState(selectedModel || "gpt-5.2-codex");

  useEffect(() => {
    checkCodexStatus();
    // Load saved model preference
    const savedModel = localStorage.getItem("codex-model");
    if (savedModel) {
      setModel(savedModel);
      onModelChange?.(savedModel);
    }
  }, []);

  const checkCodexStatus = async () => {
    setStatus("checking");
    try {
      const response = await fetch("/api/codex/status");
      const data = await response.json();

      if (data.installed && data.authenticated) {
        setStatus("ready");
        setCodexEmail(data.codexEmail || null);
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

  const clearDeviceAuth = useCallback(() => {
    setDeviceAuthUrl(null);
    setDeviceCode(null);
    setRawAuthOutput(null);
    setCodeCopied(false);
  }, []);

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    clearDeviceAuth();
    try {
      const response = await fetch("/api/codex/auth", { method: "POST" });
      const data = await response.json();

      if (data.authUrl) {
        setDeviceAuthUrl(data.authUrl);
        setDeviceCode(data.deviceCode || null);
      } else if (data.rawOutput) {
        setRawAuthOutput(data.rawOutput);
      }

      if (data.authStarted) {
        // Poll for auth completion
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch("/api/codex/status");
            const statusData = await statusRes.json();
            if (statusData.authenticated) {
              clearInterval(pollInterval);
              setStatus("ready");
              onStatusChange(true);
              setIsAuthenticating(false);
              clearDeviceAuth();
            }
          } catch {
            // Ignore polling errors
          }
        }, 3000);

        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsAuthenticating(false);
        }, 300000);
      } else {
        setIsAuthenticating(false);
      }
    } catch (error) {
      console.error("Auth error:", error);
      setIsAuthenticating(false);
    }
  };

  const handleCopyCode = async () => {
    if (deviceCode) {
      await navigator.clipboard.writeText(deviceCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/codex/auth", { method: "DELETE" });
      setStatus("not-authenticated");
      setCodexEmail(null);
      onStatusChange(false);
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  const handleModelSelect = (modelId: string) => {
    setModel(modelId);
    localStorage.setItem("codex-model", modelId);
    onModelChange?.(modelId);
    setIsModelDropdownOpen(false);
  };

  const currentModel = CODEX_MODELS.find((m) => m.id === model) || CODEX_MODELS[1];

  return (
    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3">
      {/* Status row */}
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
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span className="text-xs text-emerald-400">
                  Connected{codexEmail ? ` (${codexEmail})` : ""}
                </span>
                <button
                  onClick={handleDisconnect}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>
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
                <span className="text-xs text-yellow-400">OpenAI login required</span>
              </>
            )}
          </div>
        </div>

        {status === "not-authenticated" && (
          <div className="flex items-center gap-1.5">
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
              {isAuthenticating ? "Waiting..." : "Login to OpenAI"}
            </button>
            <button
              onClick={() => setShowAuthHelp(!showAuthHelp)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Setup instructions"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {status === "not-installed" && (
          <div className="text-xs text-gray-500">
            Run: <code className="bg-gray-900 px-1 rounded">npm i -g @openai/codex</code>
          </div>
        )}
      </div>

      {/* Auth setup help */}
      {showAuthHelp && (
        <div className="p-3 bg-gray-900 rounded-lg border border-gray-600 space-y-2">
          <p className="text-xs font-medium text-white">First-time setup required:</p>
          <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
            <li>
              Go to{" "}
              <a
                href="https://chatgpt.com/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                ChatGPT Settings
              </a>
              {" "}&rarr; <strong>Security</strong>
            </li>
            <li>
              Enable <strong>&quot;Device code authorization for Codex&quot;</strong>
            </li>
            <li>Come back here and click &quot;Login to OpenAI&quot;</li>
            <li>Open the link shown, enter the one-time code</li>
          </ol>
          <p className="text-xs text-gray-500 mt-2">
            This is required for headless/remote environments where a browser popup isn&apos;t available.
          </p>
        </div>
      )}

      {/* Device auth UI */}
      {isAuthenticating && deviceAuthUrl && (
        <div className="p-3 bg-gray-900 rounded-lg border border-emerald-700/50 space-y-2">
          <p className="text-xs text-gray-300">Open this link and enter the code:</p>
          <a
            href={deviceAuthUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 underline break-all"
          >
            {deviceAuthUrl}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
          {deviceCode && (
            <div className="flex items-center gap-2 mt-2">
              <code className="text-lg font-bold font-mono text-white bg-gray-800 px-3 py-1 rounded tracking-wider">
                {deviceCode}
              </code>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              >
                <Copy className="w-3 h-3" />
                {codeCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">Waiting for authentication...</p>
        </div>
      )}

      {/* Raw output fallback when no URL could be parsed */}
      {isAuthenticating && !deviceAuthUrl && rawAuthOutput && (
        <div className="p-3 bg-gray-900 rounded-lg border border-yellow-700/50">
          <p className="text-xs text-gray-300 mb-1">Follow these instructions:</p>
          <pre className="text-xs text-yellow-300 whitespace-pre-wrap font-mono">{rawAuthOutput}</pre>
        </div>
      )}

      {/* Model selector - only show when connected */}
      {status === "ready" && (
        <div className="relative">
          <label className="text-xs text-gray-500 mb-1 block">Model</label>
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white hover:border-gray-600 transition-colors"
          >
            <span>{currentModel.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{currentModel.description}</span>
              <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isModelDropdownOpen && "rotate-180")} />
            </div>
          </button>

          {isModelDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsModelDropdownOpen(false)} />
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden max-h-80 overflow-y-auto">
                {/* Recommended */}
                <div className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-gray-900/50 sticky top-0">
                  Recommended
                </div>
                {CODEX_MODELS.filter((m) => m.category === "recommended").map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelSelect(m.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-700/50 transition-colors",
                      model === m.id && "bg-emerald-500/10"
                    )}
                  >
                    <span className="text-sm text-white">{m.name}</span>
                    <span className="text-xs text-gray-500">{m.description}</span>
                  </button>
                ))}

                {/* Alternative */}
                <div className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-gray-900/50 sticky top-0">
                  GPT-5 Family
                </div>
                {CODEX_MODELS.filter((m) => m.category === "alternative").map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelSelect(m.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-700/50 transition-colors",
                      model === m.id && "bg-emerald-500/10"
                    )}
                  >
                    <span className="text-sm text-white">{m.name}</span>
                    <span className="text-xs text-gray-500">{m.description}</span>
                  </button>
                ))}

                {/* Original Codex */}
                <div className="px-3 py-1.5 text-xs font-medium text-purple-400 bg-gray-900/50 sticky top-0">
                  Original Codex
                </div>
                {CODEX_MODELS.filter((m) => m.category === "original").map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelSelect(m.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-700/50 transition-colors",
                      model === m.id && "bg-emerald-500/10"
                    )}
                  >
                    <span className="text-sm text-white">{m.name}</span>
                    <span className="text-xs text-gray-500">{m.description}</span>
                  </button>
                ))}

                {/* Reasoning Models */}
                <div className="px-3 py-1.5 text-xs font-medium text-orange-400 bg-gray-900/50 sticky top-0">
                  Reasoning Models
                </div>
                {CODEX_MODELS.filter((m) => m.category === "reasoning").map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleModelSelect(m.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-700/50 transition-colors",
                      model === m.id && "bg-emerald-500/10"
                    )}
                  >
                    <span className="text-sm text-white">{m.name}</span>
                    <span className="text-xs text-gray-500">{m.description}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

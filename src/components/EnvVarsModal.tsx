"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Check, FileText, Upload, Eye, EyeOff, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnvVarsModalProps {
  repoName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface EnvVar {
  key: string;
  value: string;
}

export function EnvVarsModal({ repoName, isOpen, onClose }: EnvVarsModalProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("http://localhost:3001");
  const [previewPort, setPreviewPort] = useState("3001");
  const [showValues, setShowValues] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current dev server URL
  useEffect(() => {
    async function fetchDevServerUrl() {
      try {
        const res = await fetch("/api/sandbox/dev-server");
        const data = await res.json();
        if (data.url) {
          setPreviewUrl(data.url);
          setPreviewPort(data.port?.toString() || "3001");
        }
      } catch {
        // Use defaults
      }
    }
    if (isOpen) {
      fetchDevServerUrl();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && repoName) {
      loadEnvVars();
    }
  }, [isOpen, repoName]);

  const parseEnvFile = (content: string): EnvVar[] => {
    const vars: EnvVar[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Find first = sign and split there (value can contain = signs)
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex);
      let value = trimmed.substring(eqIndex + 1);

      // Validate key format
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars.push({ key, value });
    }

    return vars;
  };

  const loadEnvVars = async () => {
    setIsLoading(true);
    try {
      // Load from the actual .env.local file on disk
      const res = await fetch(`/api/sandbox/env?repo=${repoName}&fromFile=true`);
      const data = await res.json();

      if (data.content) {
        // Parse the raw file content
        setEnvVars(parseEnvFile(data.content));
        setFileName(".env.local");
      } else if (data.envVars) {
        // Fallback to database
        const vars = Object.entries(data.envVars).map(([key, value]) => ({
          key,
          value: value as string,
        }));
        setEnvVars(vars);
      } else {
        setEnvVars([]);
      }
    } catch (err) {
      console.error("Failed to load env vars:", err);
      setEnvVars([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseEnvFile(content);
      setEnvVars(parsed);
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);

    // Auto-fix localhost URLs
    const urlKeys = [
      "NEXT_PUBLIC_APP_URL",
      "NEXTAUTH_URL",
      "BETTER_AUTH_URL",
      "AUTH_URL",
      "NEXT_PUBLIC_BETTER_AUTH_URL",
    ];

    const fixedVars = envVars.map(({ key, value }) => {
      if (urlKeys.includes(key) && value.includes("localhost:3000")) {
        return { key, value: value.replace("localhost:3000", `localhost:${previewPort}`) };
      }
      return { key, value };
    });

    // Convert to .env format string for direct file write
    const envContent = fixedVars.map(({ key, value }) => `${key}=${value}`).join("\n");

    try {
      await fetch("/api/sandbox/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName, envContent }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save env vars:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const maskValue = (value: string): string => {
    if (value.length <= 8) return "••••••••";
    return value.substring(0, 4) + "••••" + value.substring(value.length - 4);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-medium text-white">
              Environment Variables — <span className="text-gray-400">{repoName}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info box */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-300 font-medium mb-1">Preview URL Configuration</p>
                <p className="text-xs text-blue-200/70">
                  The sandbox runs on <code className="text-blue-300 bg-blue-500/20 px-1 rounded">{previewUrl}</code>.
                  URLs with <code className="text-blue-300">localhost:3000</code> will be auto-converted to port <code className="text-blue-300">{previewPort}</code>.
                </p>
              </div>

              {/* File upload */}
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".env,.env.local,.env.example,text/plain"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm text-white transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload .env file
                </button>
                {fileName && (
                  <span className="text-sm text-gray-400">
                    Loaded: <code className="text-emerald-400">{fileName}</code>
                  </span>
                )}
              </div>

              {/* Variables list */}
              {envVars.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {envVars.length} variable{envVars.length !== 1 ? "s" : ""} loaded
                    </span>
                    <button
                      onClick={() => setShowValues(!showValues)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      {showValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showValues ? "Hide values" : "Show values"}
                    </button>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    <div className="max-h-80 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-900 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-400 font-medium">Key</th>
                            <th className="text-left px-3 py-2 text-gray-400 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {envVars.map(({ key, value }, idx) => (
                            <tr key={idx} className="hover:bg-gray-700/30">
                              <td className="px-3 py-1.5 font-mono text-emerald-400 whitespace-nowrap">{key}</td>
                              <td className="px-3 py-1.5 font-mono text-gray-300 break-all">
                                {showValues ? value : maskValue(value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No environment variables loaded</p>
                  <p className="text-xs mt-1">Upload your <code>.env.local</code> file to get started</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 bg-gray-800/30 shrink-0">
          <p className="text-xs text-gray-500">
            Will be saved to <code className="text-gray-400">.env.local</code> in the repo
          </p>
          <button
            onClick={handleSave}
            disabled={isSaving || envVars.length === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              saved
                ? "bg-emerald-600 text-white"
                : "bg-emerald-600 hover:bg-emerald-500 text-white",
              (isSaving || envVars.length === 0) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : null}
            {saved ? "Saved!" : "Save & Restart"}
          </button>
        </div>
      </div>
    </div>
  );
}

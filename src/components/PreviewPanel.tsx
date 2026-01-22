"use client";

import { useState } from "react";
import { RefreshCw, ExternalLink, Smartphone, Monitor, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewportSize = "desktop" | "tablet" | "mobile";

interface PreviewPanelProps {
  previewUrl: string;
  isLoading?: boolean;
  refreshKey?: number;
}

export function PreviewPanel({ previewUrl, isLoading, refreshKey = 0 }: PreviewPanelProps) {
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [localKey, setLocalKey] = useState(0);

  // Combine external refresh key with local key for iframe refresh
  const iframeKey = refreshKey + localKey;

  const viewportSizes = {
    desktop: "w-full",
    tablet: "w-[768px]",
    mobile: "w-[375px]",
  };

  const handleRefresh = () => {
    setLocalKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(previewUrl, "_blank");
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Live Preview</h2>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewport("desktop")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewport === "desktop"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              )}
              title="Desktop view"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport("tablet")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewport === "tablet"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              )}
              title="Tablet view"
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewport("mobile")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewport === "mobile"
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white"
              )}
              title="Mobile view"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Refresh preview"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenExternal}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* URL bar */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-gray-400 truncate">{previewUrl}</span>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 overflow-auto bg-gray-900 flex items-start justify-center p-4">
        <div
          className={cn(
            "bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300",
            viewportSizes[viewport],
            viewport !== "desktop" && "h-[80vh]"
          )}
          style={{ height: viewport === "desktop" ? "100%" : undefined }}
        >
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <div className="text-gray-500">Loading preview...</div>
            </div>
          ) : (
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="w-full h-full border-0"
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          )}
        </div>
      </div>
    </div>
  );
}

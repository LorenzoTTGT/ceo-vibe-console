"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Undo2, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  patch?: string;
}

interface PromptPanelProps {
  onApplyPatch: (patch: string) => Promise<void>;
  isCodexReady: boolean;
  onUndo: () => void;
  canUndo: boolean;
}

export function PromptPanel({ onApplyPatch, isCodexReady, onUndo, canUndo }: PromptPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "Welcome! Describe the UI changes you want to make. For example: \"Make the header background darker\" or \"Increase the button padding\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isCodexReady) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/codex/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMessage.content }),
      });

      const data = await response.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `Error: ${data.error}`,
            timestamp: new Date(),
          },
        ]);
      } else {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: data.explanation || "Changes applied successfully!",
          timestamp: new Date(),
          patch: data.patch,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (data.patch) {
          await onApplyPatch(data.patch);
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Failed to process request: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Prompt</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              "p-2 rounded-lg transition-colors",
              canUndo
                ? "text-gray-400 hover:text-white hover:bg-gray-700"
                : "text-gray-600 cursor-not-allowed"
            )}
            title="Undo last change"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="View history"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "rounded-lg p-3",
              message.role === "user"
                ? "bg-emerald-600/20 border border-emerald-500/30 ml-8"
                : message.role === "system"
                ? "bg-gray-800 border border-gray-700"
                : "bg-gray-800 border border-gray-700 mr-8"
            )}
          >
            <p className="text-sm text-gray-200 whitespace-pre-wrap">
              {message.content}
            </p>
            {message.patch && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                  View patch
                </summary>
                <pre className="mt-2 text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-x-auto">
                  {message.patch}
                </pre>
              </details>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        {!isCodexReady && (
          <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-xs text-yellow-400">
              OpenAI Codex not connected. Please sign in first.
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the UI change you want..."
            disabled={!isCodexReady || isLoading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none disabled:opacity-50"
            rows={2}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isCodexReady}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

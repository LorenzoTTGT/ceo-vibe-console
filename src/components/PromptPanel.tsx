"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Undo2, History, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageAttachment {
  id: string;
  file: File;
  preview: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  patch?: string;
  images?: string[]; // base64 previews for display
}

interface PromptPanelProps {
  onApplyPatch: (patch: string) => Promise<void>;
  isCodexReady: boolean;
  isRepoReady?: boolean;
  repoName?: string;
  model?: string;
  onUndo: () => void;
  canUndo: boolean;
}

export function PromptPanel({ onApplyPatch, isCodexReady, isRepoReady = true, repoName, model, onUndo, canUndo }: PromptPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "Welcome! Describe the UI changes you want to make. You can paste or upload images (screenshots, designs) to help explain what you want.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle paste events for images
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          addImage(file);
        }
        break;
      }
    }
  }, []);

  // Add paste listener
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener("paste", handlePaste);
      return () => textarea.removeEventListener("paste", handlePaste);
    }
  }, [handlePaste]);

  const addImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setImages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          file,
          preview,
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) {
          addImage(file);
        }
      });
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && images.length === 0) || isLoading || !isCodexReady || !isRepoReady) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || "(Image attached)",
      timestamp: new Date(),
      images: images.map((img) => img.preview),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Prepare form data for images
    const formData = new FormData();
    formData.append("prompt", input.trim());
    formData.append("repo", repoName || "");
    formData.append("model", model || "gpt-5.2-codex");

    // Add images
    images.forEach((img, index) => {
      formData.append(`image_${index}`, img.file);
    });

    setInput("");
    setImages([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/codex/prompt", {
        method: "POST",
        body: formData,
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

  const isDisabled = !isCodexReady || !isRepoReady || isLoading;

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
            {/* Display attached images */}
            {message.images && message.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {message.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Attachment ${idx + 1}`}
                    className="max-w-32 max-h-32 rounded border border-gray-600 object-cover"
                  />
                ))}
              </div>
            )}
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
        {isCodexReady && !isRepoReady && (
          <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-400">
              Setting up repository. Please wait...
            </p>
          </div>
        )}

        {/* Image previews */}
        {images.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.preview}
                  alt="Upload preview"
                  className="w-16 h-16 object-cover rounded border border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Image upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className={cn(
              "px-3 py-2 rounded-lg transition-colors",
              isDisabled
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
            )}
            title="Upload image (or paste with Ctrl+V)"
          >
            <ImagePlus className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the UI change... (paste images with Ctrl+V)"
            disabled={isDisabled}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none disabled:opacity-50"
            rows={2}
          />
          <button
            type="submit"
            disabled={(!input.trim() && images.length === 0) || isLoading || !isCodexReady || !isRepoReady}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Tip: Paste screenshots directly or click the image button to upload
        </p>
      </form>
    </div>
  );
}

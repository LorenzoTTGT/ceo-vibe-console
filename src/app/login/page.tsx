"use client";

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-gray-700 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Guiido Vibe Console
          </h1>
          <p className="text-gray-400">
            Tweak the UI with AI assistance
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => signIn("github", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-3 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-gray-600"
          >
            <Github className="w-5 h-5" />
            Sign in with GitHub
          </button>
        </div>

        <p className="text-gray-500 text-sm text-center mt-6">
          Only authorized accounts can access this console
        </p>
      </div>
    </div>
  );
}

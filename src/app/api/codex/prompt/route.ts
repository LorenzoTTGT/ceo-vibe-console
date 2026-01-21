import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// Path to the sandbox workspace (guiido-carsharing clone)
const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "/workspace/guiido-carsharing";

// Allowed paths for editing (security constraint)
const ALLOWED_PATHS = [
  "src/app/",
  "src/components/",
  "src/lib/",
  "public/",
];

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Create a system prompt that constrains the AI to UI changes
    const systemPrompt = `You are a UI assistant helping make visual changes to a Next.js application.
The user is the CEO who wants to tweak the UI.

RULES:
1. Only modify files in: ${ALLOWED_PATHS.join(", ")}
2. Focus on visual/UI changes: colors, spacing, typography, layout
3. Do NOT modify: authentication, API routes, database logic, business logic
4. Always explain what changes you're making
5. Output changes as a unified diff patch

WORKSPACE: ${WORKSPACE_PATH}

The user request is: ${prompt}

Respond with:
1. A brief explanation of what you'll change
2. The unified diff patch to apply

Format your response as JSON:
{
  "explanation": "What I'm changing...",
  "patch": "--- a/path/to/file\\n+++ b/path/to/file\\n@@ ... @@\\n..."
}`;

    // Create temp file for the prompt
    const tempDir = "/tmp/ceo-codex";
    await mkdir(tempDir, { recursive: true });
    const promptFile = path.join(tempDir, `prompt-${Date.now()}.txt`);
    await writeFile(promptFile, systemPrompt);

    // Run codex with the prompt
    // Note: The exact codex CLI syntax may vary - adjust based on actual CLI
    const { stdout, stderr } = await execAsync(
      `cd ${WORKSPACE_PATH} && codex --prompt "${prompt}" --context . --json 2>&1`,
      {
        timeout: 120000, // 2 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );

    // Try to parse the response
    try {
      // Look for JSON in the output
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const response = JSON.parse(jsonMatch[0]);

        // Validate the patch only touches allowed paths
        if (response.patch) {
          const patchPaths = response.patch.match(/(?:---|\+\+\+) [ab]\/([^\n]+)/g) || [];
          for (const patchPath of patchPaths) {
            const filePath = patchPath.replace(/(?:---|\+\+\+) [ab]\//, "");
            const isAllowed = ALLOWED_PATHS.some((allowed) => filePath.startsWith(allowed));
            if (!isAllowed) {
              return NextResponse.json({
                error: `Cannot modify file outside allowed paths: ${filePath}`,
              });
            }
          }
        }

        return NextResponse.json(response);
      }

      // If no JSON found, return the raw output as explanation
      return NextResponse.json({
        explanation: stdout || stderr || "No response from Codex",
        patch: null,
      });
    } catch {
      return NextResponse.json({
        explanation: stdout || stderr,
        patch: null,
      });
    }
  } catch (error) {
    console.error("Codex prompt error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to process prompt",
    });
  }
}

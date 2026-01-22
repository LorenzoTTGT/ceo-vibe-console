import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

// Path to the sandbox workspace
const WORKSPACE_PATH = process.env.SANDBOX_WORKSPACE_PATH || "./data/workspace";

// Temp directory for images
const TEMP_DIR = "/tmp/ceo-codex-images";

// Allowed paths for editing (security constraint)
const ALLOWED_PATHS = [
  "src/app/",
  "src/components/",
  "src/lib/",
  "public/",
];

export async function POST(request: NextRequest) {
  const imagePaths: string[] = [];

  try {
    // Check content type to determine how to parse
    const contentType = request.headers.get("content-type") || "";

    let prompt: string;
    let repo: string;
    let model: string;

    if (contentType.includes("multipart/form-data")) {
      // Parse as FormData (with images)
      const formData = await request.formData();
      prompt = formData.get("prompt") as string || "";
      repo = formData.get("repo") as string || "";
      model = formData.get("model") as string || "gpt-5.2-codex";

      // Save images to temp directory
      await mkdir(TEMP_DIR, { recursive: true });

      for (const [key, value] of formData.entries()) {
        if (key.startsWith("image_") && value instanceof File) {
          const file = value as File;
          const buffer = Buffer.from(await file.arrayBuffer());
          const ext = file.name.split(".").pop() || "png";
          const imagePath = path.join(TEMP_DIR, `${Date.now()}-${key}.${ext}`);
          await writeFile(imagePath, buffer);
          imagePaths.push(imagePath);
        }
      }
    } else {
      // Parse as JSON (no images)
      const json = await request.json();
      prompt = json.prompt || "";
      repo = json.repo || "";
      model = json.model || "gpt-5.2-codex";
    }

    if (!prompt && imagePaths.length === 0) {
      return NextResponse.json({ error: "Prompt or image is required" }, { status: 400 });
    }

    // Determine the workspace path
    const repoPath = repo ? path.join(WORKSPACE_PATH, repo) : WORKSPACE_PATH;

    // Model to use (default to gpt-5.2-codex)
    const selectedModel = model || "gpt-5.2-codex";

    // Build the full prompt with constraints
    const fullPrompt = `You are a UI assistant helping make visual changes to a Next.js application.
The user is the CEO who wants to tweak the UI.

RULES:
1. Only modify files in: ${ALLOWED_PATHS.join(", ")}
2. Focus on visual/UI changes: colors, spacing, typography, layout
3. Do NOT modify: authentication, API routes, database logic, business logic
4. Make the changes directly to the files
${imagePaths.length > 0 ? "5. I've attached image(s) showing what I want - use them as reference for the changes" : ""}

USER REQUEST: ${prompt || "See the attached image(s) for what I want to achieve"}

Make the requested changes now.`;

    // Escape the prompt for shell (replace double quotes and handle special chars)
    const escapedPrompt = fullPrompt.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');

    // Build image flags for codex exec
    const imageFlags = imagePaths.map((p) => `-i "${p}"`).join(" ");

    // Run codex exec with --full-auto to allow edits, --json for machine-readable output, -m for model, and -i for images
    const command = `cd "${repoPath}" && codex exec --full-auto --json -m "${selectedModel}" ${imageFlags} "${escapedPrompt}"`;

    console.log("Running codex command:", command);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5 minute timeout for longer operations
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Clean up temp images
    for (const imagePath of imagePaths) {
      try {
        await unlink(imagePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Parse JSON Lines output from codex exec --json
    // Each line is a separate JSON event
    const lines = stdout.split('\n').filter(line => line.trim());
    let explanation = '';
    let filesChanged: string[] = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);

        // Extract agent messages for explanation
        if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
          explanation += (event.item.text || '') + '\n';
        }

        // Track file changes
        if (event.type === 'item.completed' && event.item?.type === 'tool_call') {
          const toolName = event.item.name || '';
          if (toolName.includes('write') || toolName.includes('edit')) {
            const filePath = event.item.arguments?.file_path || event.item.arguments?.path;
            if (filePath) {
              filesChanged.push(filePath);
            }
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }

    // If we got any explanation, return success
    if (explanation.trim()) {
      return NextResponse.json({
        explanation: explanation.trim(),
        filesChanged,
        success: true,
      });
    }

    // Fallback: return raw output
    return NextResponse.json({
      explanation: stdout || stderr || "Codex completed but returned no explanation.",
      filesChanged: [],
      success: true,
    });

  } catch (error) {
    console.error("Codex prompt error:", error);

    // Clean up temp images on error
    for (const imagePath of imagePaths) {
      try {
        await unlink(imagePath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Extract useful error info
    const errorMessage = error instanceof Error ? error.message : "Failed to process prompt";
    const errorOutput = (error as { stdout?: string; stderr?: string })?.stdout ||
                       (error as { stdout?: string; stderr?: string })?.stderr || '';

    return NextResponse.json({
      error: errorMessage,
      details: errorOutput,
    });
  }
}

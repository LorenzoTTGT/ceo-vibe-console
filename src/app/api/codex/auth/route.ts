import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    // Try to start browser-based auth flow
    // The codex CLI should open a browser window
    exec("codex login", { timeout: 60000 });

    return NextResponse.json({
      message: "Auth flow started. Please complete the sign-in in the browser window that opened.",
      authStarted: true,
    });
  } catch (error) {
    console.error("Codex auth error:", error);

    // Provide manual instructions
    return NextResponse.json({
      error: "Could not start auth flow automatically. Please run 'codex login' in your terminal.",
      manual: true,
    });
  }
}

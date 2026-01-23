import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { execFileAsync } from "@/lib/validation";

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Try to start browser-based auth flow
    execFileAsync("codex", ["login"], { timeout: 60000 }).catch(() => {});

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

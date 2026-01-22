import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Octokit } from "octokit";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const accessToken = (session as { accessToken?: string }).accessToken;

    if (!accessToken) {
      return NextResponse.json({ error: "GitHub token not available" }, { status: 401 });
    }

    const octokit = new Octokit({ auth: accessToken });

    // Fetch repos where user has push access
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      affiliation: "owner,collaborator,organization_member",
    });

    // Filter to repos where user can push
    const pushableRepos = repos
      .filter((repo) => repo.permissions?.push)
      .map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        defaultBranch: repo.default_branch,
        private: repo.private,
        description: repo.description,
        updatedAt: repo.updated_at,
      }));

    return NextResponse.json({ repos: pushableRepos });
  } catch (error) {
    console.error("Fetch repos error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to fetch repos",
    }, { status: 500 });
  }
}

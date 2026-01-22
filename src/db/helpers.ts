import { getDb, schema } from "./index";
import { eq, and } from "drizzle-orm";

// Get or create user from GitHub profile
export function getOrCreateUser(githubId: string, email?: string | null, name?: string | null) {
  const db = getDb();

  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.githubId, githubId))
    .get();

  if (existing) {
    return existing;
  }

  const result = db
    .insert(schema.users)
    .values({
      githubId,
      email: email || null,
      name: name || null,
    })
    .returning()
    .get();

  return result;
}

// Get user's cloned repos
export function getUserRepos(userId: number) {
  const db = getDb();

  return db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.userId, userId))
    .orderBy(schema.repos.lastUsedAt)
    .all();
}

// Get or create repo for user
export function getOrCreateRepo(
  userId: number,
  repoData: {
    name: string;
    owner: string;
    fullName: string;
    defaultBranch: string;
  }
) {
  const db = getDb();

  const existing = db
    .select()
    .from(schema.repos)
    .where(
      and(
        eq(schema.repos.userId, userId),
        eq(schema.repos.name, repoData.name)
      )
    )
    .get();

  if (existing) {
    return existing;
  }

  const result = db
    .insert(schema.repos)
    .values({
      userId,
      ...repoData,
    })
    .returning()
    .get();

  return result;
}

// Update repo last used time
export function touchRepo(repoId: number) {
  const db = getDb();

  db.update(schema.repos)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.repos.id, repoId))
    .run();
}

// Get env vars for a repo
export function getRepoEnvVars(repoId: number) {
  const db = getDb();

  return db
    .select()
    .from(schema.envVars)
    .where(eq(schema.envVars.repoId, repoId))
    .all();
}

// Set env vars for a repo (replace all)
export function setRepoEnvVars(repoId: number, envVars: Record<string, string>) {
  const db = getDb();

  // Delete existing
  db.delete(schema.envVars).where(eq(schema.envVars.repoId, repoId)).run();

  // Insert new
  const entries = Object.entries(envVars);
  if (entries.length > 0) {
    db.insert(schema.envVars)
      .values(
        entries.map(([key, value]) => ({
          repoId,
          key,
          value,
        }))
      )
      .run();
  }
}

// Get repo by user and name
export function getRepoByName(userId: number, repoName: string) {
  const db = getDb();

  return db
    .select()
    .from(schema.repos)
    .where(
      and(
        eq(schema.repos.userId, userId),
        eq(schema.repos.name, repoName)
      )
    )
    .get();
}

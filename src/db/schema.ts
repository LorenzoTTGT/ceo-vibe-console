import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  githubId: text("github_id").notNull().unique(),
  email: text("email"),
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const repos = sqliteTable("repos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  fullName: text("full_name").notNull(),
  defaultBranch: text("default_branch").notNull(),
  clonedAt: integer("cloned_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

export const envVars = sqliteTable("env_vars", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id").notNull().references(() => repos.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;
export type EnvVar = typeof envVars.$inferSelect;
export type NewEnvVar = typeof envVars.$inferInsert;

import { NextAuthOptions, getServerSession } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getOrCreateUser } from "@/db/helpers";

// Extend the session type
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user?: {
      id?: string;
      githubId?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    githubId?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign in, save the access token and GitHub ID
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        // GitHub profile has id as a number
        const githubProfile = profile as { id?: number; login?: string };
        token.githubId = githubProfile.id?.toString();
        token.githubLogin = githubProfile.login;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass the access token and GitHub ID to the session
      session.accessToken = token.accessToken as string;
      if (session.user) {
        session.user.githubId = token.githubId as string;
      }
      return session;
    },
    async signIn({ profile }) {
      // Only allow specific emails if configured
      const allowedEmails = process.env.ALLOWED_EMAILS?.split(",").filter(e => e.trim()) || [];

      // If no emails configured, allow all
      if (allowedEmails.length === 0) return true;

      // Check if user's email is in the allowed list
      const userEmail = profile?.email || "";
      return allowedEmails.includes(userEmail);
    },
  },
  events: {
    async signIn({ user, profile }) {
      // Create/update user in our database
      if (profile) {
        const githubId = (profile as { id?: number }).id?.toString();
        if (githubId) {
          await getOrCreateUser(githubId, user.email, user.name);
        }
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

export async function auth() {
  return getServerSession(authOptions);
}

// Helper to get current user from database
export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user?.githubId) {
    return null;
  }

  const user = getOrCreateUser(
    session.user.githubId,
    session.user.email,
    session.user.name
  );

  return user;
}

import { NextAuthOptions, getServerSession } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

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
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as { accessToken?: string }).accessToken = token.accessToken as string;
      return session;
    },
    async signIn({ profile }) {
      // Only allow specific emails (CEO + you)
      const allowedEmails = process.env.ALLOWED_EMAILS?.split(",") || [];
      if (allowedEmails.length === 0) return true;
      return allowedEmails.includes(profile?.email || "");
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

export const auth = () => getServerSession(authOptions);

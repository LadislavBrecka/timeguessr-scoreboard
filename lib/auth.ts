import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Admin",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = process.env.ADMIN_USERNAME ?? "admin";
        const password = process.env.ADMIN_PASSWORD;
        if (!password) {
          console.warn("ADMIN_PASSWORD is not set; admin login will fail.");
          return null;
        }
        if (
          credentials?.username === username &&
          credentials?.password === password
        ) {
          return { id: "admin", name: "Admin", role: "admin" };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  secret: process.env.AUTH_SECRET,
};

export function isAdminSession(session: { user?: { role?: string } } | null): boolean {
  return session?.user?.role === "admin";
}

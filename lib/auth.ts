import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { loadStore } from "./store";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Username & password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = (credentials?.username ?? "").trim();
        const password = credentials?.password ?? "";
        if (!username || !password) return null;

        const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminPassword && username === adminUsername && password === adminPassword) {
          return { id: "admin", name: adminUsername, role: "admin" };
        }

        const store = await loadStore();
        const user = store.users.find(
          (u) => u.username === username
        );
        if (!user) return null;
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.username, name: user.username, role: "player" };
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

export function isPlayerSession(session: { user?: { role?: string; name?: string | null } } | null): boolean {
  return session?.user?.role === "player";
}

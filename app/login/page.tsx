"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid username or password.");
      return;
    }
    if (result?.ok) {
      window.location.href = callbackUrl;
    }
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-stone-300 bg-stone-50/80 p-6 shadow-sm dark:border-stone-600 dark:bg-stone-900/50">
        <h1 className="mb-2 text-xl font-semibold text-stone-900 dark:text-stone-100">
          Sign in
        </h1>
        <p className="mb-6 text-sm text-stone-600 dark:text-stone-400">
          Sign in as admin to create events, or as a player to add your scores.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-stone-600 dark:text-stone-400">
              Username
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-stone-600 dark:text-stone-400">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            />
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-stone-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-600 disabled:opacity-50 dark:bg-stone-600 dark:hover:bg-stone-500"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <Link
              href="/register"
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Create account
            </Link>
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm px-4 py-20 text-center text-stone-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

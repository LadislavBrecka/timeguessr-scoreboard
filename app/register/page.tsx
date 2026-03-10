"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register } from "@/app/actions";

export default function RegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await register(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/login?registered=1");
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-stone-300 bg-stone-50/80 p-6 shadow-sm dark:border-stone-600 dark:bg-stone-900/50">
        <h1 className="mb-2 text-xl font-semibold text-stone-900 dark:text-stone-100">
          Create account
        </h1>
        <p className="mb-6 text-sm text-stone-600 dark:text-stone-400">
          Choose a username and password. You’ll use them to sign in and add your scores.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-stone-600 dark:text-stone-400">Username</span>
            <input
              type="text"
              name="username"
              required
              minLength={2}
              maxLength={32}
              autoComplete="username"
              placeholder="e.g. player1"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            />
            <span className="text-xs text-stone-500 dark:text-stone-400">
              Letters, numbers, underscore, hyphen. 2–32 characters.
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-stone-600 dark:text-stone-400">Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-stone-600 dark:text-stone-400">Confirm password</span>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100"
            />
          </label>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-stone-700 px-4 py-2 font-medium text-white transition hover:bg-stone-600 disabled:opacity-50 dark:bg-stone-600 dark:hover:bg-stone-500"
            >
              {loading ? "Creating…" : "Create account"}
            </button>
            <Link
              href="/login"
              className="rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

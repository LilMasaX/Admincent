"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid credentials");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border p-6 shadow">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <input
          name="email"
          type="email"
          required
          placeholder="email"
          className="w-full rounded-md border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="password"
          className="w-full rounded-md border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? "..." : "Sign in"}
        </button>
        <p className="text-sm">
          No account? <a className="underline" href="/register">Register</a>
        </p>
      </form>
    </main>
  );
}

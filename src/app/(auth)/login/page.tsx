"use client";
import Image from "next/image";
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
      setError("Credenciales inválidas");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo.webp" alt="Nominapp" width={64} height={64} className="h-14 w-auto" />
          <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
          <p className="text-sm text-[var(--color-muted)]">Bienvenido a Nominapp</p>
        </div>
        <Field name="email" type="email" placeholder="correo@empresa.com" required />
        <Field name="password" type="password" placeholder="••••••••" required minLength={6} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-xl bg-[var(--color-accent)] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm placeholder:text-neutral-500 focus:border-[var(--color-accent)] focus:outline-none"
    />
  );
}

import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="min-h-screen grid place-items-center p-8">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center shadow-2xl">
        <Image
          src="/logo.webp"
          alt="Nominapp"
          width={140}
          height={140}
          priority
          className="mx-auto mb-6 h-20 w-auto"
        />
        <h1 className="text-3xl font-semibold tracking-tight">Nominapp</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Sistema de nómina: desprendibles, colaboradores, historial y plantillas.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)]"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-2)]"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </main>
  );
}

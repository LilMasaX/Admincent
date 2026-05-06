import { auth, signOut } from "@/lib/auth/config";

export default async function DashboardPage() {
  const session = await auth();
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="rounded-md border px-3 py-1 text-sm">Sign out</button>
        </form>
      </header>
      <p className="text-sm text-neutral-600">
        Signed in as <span className="font-mono">{session?.user?.email}</span>
      </p>
      <nav className="grid gap-3 sm:grid-cols-2">
        <a href="/templates" className="rounded-2xl border p-4 hover:bg-neutral-50">
          <h2 className="font-semibold">Templates</h2>
          <p className="text-sm text-neutral-600">Upload PDF/DOCX bases.</p>
        </a>
        <a href="/certificates" className="rounded-2xl border p-4 hover:bg-neutral-50">
          <h2 className="font-semibold">Certificates</h2>
          <p className="text-sm text-neutral-600">Generate from template + values.</p>
        </a>
      </nav>
    </main>
  );
}

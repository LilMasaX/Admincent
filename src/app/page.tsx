import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center p-8">
      <div className="text-center space-y-4 max-w-lg">
        <h1 className="text-4xl font-semibold">admincentic</h1>
        <p className="text-neutral-600">
          Automate certificate creation from PDF or DOCX templates.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/login" className="rounded-md bg-black px-4 py-2 text-white">
            Sign in
          </Link>
          <Link href="/register" className="rounded-md border px-4 py-2">
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}

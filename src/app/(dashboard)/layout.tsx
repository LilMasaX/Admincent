import { Toaster } from "react-hot-toast";
import { auth } from "@/lib/auth/config";
import Sidebar from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar userEmail={session?.user?.email ?? undefined} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1a1a",
            color: "#f0f0f0",
            border: "1px solid #2e2e2e",
          },
        }}
      />
    </div>
  );
}

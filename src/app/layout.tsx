import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Nominapp",
  description:
    "Genera y envía desprendibles de nómina, gestiona colaboradores y plantillas.",
  icons: { icon: "/logo.webp" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[var(--color-background)] text-[var(--color-foreground)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

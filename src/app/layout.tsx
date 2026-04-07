import type { Metadata } from "next";
import { SessionProvider } from "@/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guiido Vibe Console",
  description: "CEO UI Experimentation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-gray-900 text-white">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

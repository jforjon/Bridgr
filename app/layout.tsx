import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Bridgr",
  description: "Learn languages through smart cross-language bridges."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--bg)] font-sans text-[var(--text-primary)] antialiased">
        <ThemeProvider>
          <div className="mx-auto min-h-screen w-full max-w-2xl bg-[var(--bg)] px-4 sm:px-6">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

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
      <body className="min-h-screen bg-[var(--bg)] font-sans text-[var(--text-1)] antialiased">
        <ThemeProvider>
          {/* No horizontal padding here — every screen owns its own gutter via
              .px-page/.mx-page so fixed-position bars (which escape this
              wrapper's padding) stay aligned with in-flow content. */}
          <div className="mx-auto min-h-screen w-full max-w-2xl bg-[var(--bg)]">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

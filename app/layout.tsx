import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap"
});

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
    <html lang="en" className={plusJakarta.variable}>
      <body
        className={`${plusJakarta.className} font-sans bg-teal-900 text-white min-h-screen antialiased`}
      >
        <div className="min-h-screen w-full max-w-2xl mx-auto bg-teal-900 px-4 sm:px-6">
          {children}
        </div>
      </body>
    </html>
  );
}

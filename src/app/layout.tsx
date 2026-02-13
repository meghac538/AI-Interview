import type { Metadata } from "next";
import { Crimson_Pro, Space_Grotesk } from "next/font/google";
import "./globals.css";

const displayFont = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"]
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Interview Platform",
  description: "Live interview platform with AI-assisted evaluation and real-time monitoring."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen bg-hero-grid text-ink-900">
        {children}
      </body>
    </html>
  );
}

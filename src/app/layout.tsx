"use client";

import dynamic from "next/dynamic";
import "./globals.css";
import "./markdown-highlight.css";

const ClientShell = dynamic(() => import("@/components/client-shell"), {
  ssr: false,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>OneRecruit</title>
        <meta
          name="description"
          content="OneRecruit by OneOrigin — live candidate assessment with AI sidekick, interviewer controls, and admin analytics."
        />
        <link
          rel="preload"
          href="https://fonts.oneorigin.us/Variable/OneOriginSansVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}

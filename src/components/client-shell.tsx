"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { GlassFooter } from "@/components/glass-footer";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="pb-20">{children}</div>
      <GlassFooter />
    </ThemeProvider>
  );
}

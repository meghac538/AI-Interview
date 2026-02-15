import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "./markdown-highlight.css"
import { GlassFooter } from "@/components/glass-footer"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
})

export const metadata: Metadata = {
  title: "OneOrigin Live Assessment",
  description: "OneOrigin Inc. live candidate assessment with AI sidekick, interviewer controls, and admin analytics."
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="pb-20">
            {children}
          </div>
          <GlassFooter />
        </ThemeProvider>
      </body>
    </html>
  )
}

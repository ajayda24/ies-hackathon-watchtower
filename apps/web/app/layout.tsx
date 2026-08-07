import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import "./watchtower.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils";

export const metadata: Metadata = {
  title: "Watchtower",
  description: "Autonomous cyber deception platform",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom: on a dense console it is the fallback when a
  // value is too small to read.
  maximumScale: 5,
  themeColor: "#07090b",
}

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}

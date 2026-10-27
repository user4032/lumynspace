import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Onest } from "next/font/google"
import { Providers } from "@/components/providers"
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog"
import "./globals.css"

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lumyn.space"
const DESCRIPTION = "Світло замість лайків, стрічка з кермом, жодних темних патернів. За запрошеннями, з 16 років."
const heading = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-heading-src",
})
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Lumyn — соцмережа, яка не кричить",
    template: "%s · Lumyn",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Lumyn",
    locale: "uk_UA",
    images: ["/api/og"],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uk"
      className={`${GeistSans.variable} ${GeistMono.variable} ${heading.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <Providers>
          {children}
          <ConfirmDialogProvider />
        </Providers>
      </body>
    </html>
  )
}

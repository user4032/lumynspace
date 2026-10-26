import type { Metadata } from "next"
import { LandingView } from "@/components/landing/landing-view"

export const metadata: Metadata = {
  title: { absolute: "Lumyn — соцмережа, яка не кричить" },
  description: "Світло замість лайків, стрічка з кермом, жодних темних патернів. За запрошеннями, з 16 років.",
  alternates: { canonical: "/welcome" },
  openGraph: { url: "/welcome", title: "Lumyn — соцмережа, яка не кричить", images: ["/api/og"] },
}

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": "https://lumyn.space/#org", name: "Lumyn", url: "https://lumyn.space", logo: "https://lumyn.space/icon-512.png" },
    { "@type": "WebSite", "@id": "https://lumyn.space/#site", name: "Lumyn", url: "https://lumyn.space", inLanguage: "uk", publisher: { "@id": "https://lumyn.space/#org" } },
  ],
}

export default function WelcomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
      <LandingView />
    </>
  )
}

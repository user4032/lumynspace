import type { Metadata } from "next"
import { LandingView } from "@/components/landing/landing-view"

export const metadata: Metadata = {
  title: { absolute: "Lumyn — соцмережа, яка не кричить" },
  description: "Світло замість лайків, стрічка з кермом, жодних темних патернів. За запрошеннями, з 16 років.",
  openGraph: { images: ["/api/og"] },
}

export default function WelcomePage() {
  return <LandingView />
}

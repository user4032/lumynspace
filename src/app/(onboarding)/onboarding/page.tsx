import type { Metadata } from "next"
import { OnboardingView } from "@/components/onboarding/onboarding-view"

export const metadata: Metadata = { title: "Ласкаво просимо" }

export default function OnboardingPage() {
  return <OnboardingView />
}

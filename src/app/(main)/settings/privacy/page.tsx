import type { Metadata } from "next"
import { PrivacyView } from "@/components/settings/privacy-view"

export const metadata: Metadata = { title: "Приватність і безпека" }

export default function PrivacyPage() {
  return <PrivacyView />
}

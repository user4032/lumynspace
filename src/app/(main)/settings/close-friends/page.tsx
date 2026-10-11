import type { Metadata } from "next"
import { CloseFriendsView } from "@/components/settings/close-friends-view"
import { CirclesManager } from "@/components/settings/circles-manager"
import { isMockMode } from "@/lib/env"

export const metadata: Metadata = { title: "Близькі друзі" }

export default function CloseFriendsPage() {
  return (
    <div className="space-y-4">
      <CloseFriendsView />
      {!isMockMode && <CirclesManager />}
    </div>
  )
}

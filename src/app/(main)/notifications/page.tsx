import type { Metadata } from "next"
import { Suspense } from "react"
import { ActivityLog } from "@/components/activity-log"
import { notifications } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { listNotifications } from "@/lib/queries"

export const metadata: Metadata = { title: "Активність" }

async function LiveActivity() {
  const items = await listNotifications()
  return <ActivityLog items={items} />
}

export default function NotificationsPage() {
  return (
    <div data-layout="wide">
      {isMockMode ? (
        <ActivityLog items={notifications} />
      ) : (
        <Suspense fallback={<ActivityLog items={[]} loading />}>
          <LiveActivity />
        </Suspense>
      )}
    </div>
  )
}

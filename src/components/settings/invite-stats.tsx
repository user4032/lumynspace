"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Gift } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { getInviteReferrals } from "@/lib/actions/social"
import { formatFullDate } from "@/lib/format"
import { isMockMode } from "@/lib/env"

type Referral = { username: string; name: string; avatarUrl: string | null; joinedAt: string }

/** «Ваш вплив»: хто прийшов у Lumyn через мої інвайт-коди. */
export function InviteStats() {
  const [list, setList] = useState<Referral[] | null>(null)

  useEffect(() => {
    if (isMockMode) return
    let cancelled = false
    void getInviteReferrals().then((res) => {
      if (!cancelled) setList(res.ok && res.data ? res.data : [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (isMockMode || list === null) return null

  return (
    <Card id="referrals" className="gap-0 py-0">
      <CardHeader className="pt-5">
        <CardTitle className="flex items-center gap-2">
          <Gift className="size-4.5 text-brand" /> Ваш вплив
        </CardTitle>
        <CardDescription>
          {list.length === 0
            ? "Тут з'являться люди, які прийшли в Lumyn за вашими інвайтами."
            : `Вашими кодами скористались ${list.length} ${list.length === 1 ? "людина" : "людей"}. Саме ви зробили Lumyn трохи живішим.`}
        </CardDescription>
      </CardHeader>
      {list.length > 0 && (
        <CardContent className="pt-2 pb-4">
          <ul className="divide-y">
            {list.map((r) => (
              <li key={r.username}>
                <Link href={`/${r.username}`} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-subtle/60">
                  <UserAvatar user={{ username: r.username, name: r.name, avatarUrl: r.avatarUrl }} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">@{r.username}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatFullDate(r.joinedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

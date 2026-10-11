"use client"

import Link from "next/link"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Check, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { CloseFriendsIcon } from "@/components/icons"
import { currentUser, users } from "@/lib/mock-data"
import { useViewer, viewerActions } from "@/lib/viewer-store"
import { setCloseFriend } from "@/lib/actions/viewer"
import { cn } from "@/lib/utils"
import { isMockMode } from "@/lib/env"

const demoCandidates = users.filter((u) => u.id !== currentUser.id && !u.isPrivate)

export function CloseFriendsView() {
  const { closeFriends, blocked, people = [] } = useViewer()
  // Supabase: обираємо з тих, кого я читаю (+ ті, хто вже в близьких)
  const candidates = isMockMode ? demoCandidates : people

  const toggle = (id: string, username: string, on: boolean) => {
    viewerActions.toggle("closeFriends", id, on)
    void setCloseFriend(id, on).then((r) => {
      if (!r.ok) {
        viewerActions.toggle("closeFriends", id, !on)
        toast.error(r.error ?? "Не вдалося")
      }
    })
    toast(on ? `@${username} тепер у близьких` : `@${username} прибрано з близьких`, {
      description: on ? "Бачитиме дописи із зеленою позначкою. Сповіщення не надсилаємо." : undefined,
    })
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="pt-5">
        <CardTitle className="flex items-center gap-2">
          <CloseFriendsIcon className="size-4 text-close" /> Близькі друзі
          <span className="font-mono text-xs font-normal text-muted-foreground">{closeFriends.length}</span>
        </CardTitle>
        <CardDescription>
          Дописи з аудиторією «Близькі» бачать лише ці люди. Вони не дізнаються, що потрапили до списку чи випали з нього.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 pb-3">
        {candidates.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">Підпишіться на людей — і зможете додати їх у близькі.</p>
        )}
        <ul className="divide-y">
          {candidates
            .filter((u) => !blocked.includes(u.id))
            .map((u) => {
              const on = closeFriends.includes(u.id)
              return (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <Link href={`/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="relative">
                      <UserAvatar user={u} size="lg" className={cn("rounded-full transition-shadow", on && "ring-2 ring-close ring-offset-2 ring-offset-background")} />
                      {on && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 600, damping: 20 }}
                          className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-close text-black ring-2 ring-background"
                        >
                          <Check className="size-2.5" strokeWidth={3} />
                        </motion.span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{u.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(u.id, u.username, !on)}
                    aria-pressed={on}
                    className={cn(
                      "inline-flex min-w-[92px] items-center justify-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      on ? "bg-close/15 text-close hover:bg-close/25" : "border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {on ? (
                      "У близьких"
                    ) : (
                      <>
                        <Plus className="size-3" /> Додати
                      </>
                    )}
                  </button>
                </li>
              )
            })}
        </ul>
      </CardContent>
    </Card>
  )
}

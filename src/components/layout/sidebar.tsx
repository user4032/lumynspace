"use client"

import Link from "next/link"
import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { PenSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/user-avatar"
import { useMe } from "@/lib/viewer-store"
import { cn } from "@/lib/utils"
import { isActive, navItems, withBadges, withMyProfile } from "./nav-items"
import { useUnreadCounts } from "@/hooks/useUnreadCounts"

/** usePathname() — це URL-дані, тож активний пункт «дострімлюється» всередині Suspense */
function ActiveNav() {
  const pathname = usePathname()
  return <SidebarNav pathname={pathname} />
}

function SidebarNav({ pathname }: { pathname: string | null }) {
  const me = useMe()
  const unread = useUnreadCounts(pathname)
  return (
      <nav aria-label="Основна навігація" className="flex flex-col gap-1">
        {withBadges(withMyProfile(navItems, me.username), unread).map((item) => {
          const active = pathname !== null && isActive(pathname, item.href)
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring max-xl:justify-center max-xl:px-0",
                    active ? "bg-brand/12 text-brand" : "text-muted-foreground hover:bg-subtle hover:text-foreground"
                  )}
                >
                  <span className="relative">
                    <item.icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                    {item.badge ? (
                      <span className="absolute -top-1 -right-1.5 size-2 rounded-full bg-brand ring-2 ring-background xl:hidden" />
                    ) : null}
                  </span>
                  <span className="relative hidden xl:inline">{item.label}</span>
                  {item.badge ? (
                    <span className="relative ml-auto hidden h-5 min-w-5 items-center justify-center rounded-full bg-brand/15 px-1.5 font-mono text-[11px] font-semibold text-brand tabular xl:inline-flex">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="xl:hidden">
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
  )
}

export function Sidebar() {
  const me = useMe()
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col py-4 pr-2 md:flex md:w-[72px] xl:w-[208px]">
      <Suspense fallback={<SidebarNav pathname={null} />}>
        <ActiveNav />
      </Suspense>

      <Button asChild size="lg" variant="brand" className="mt-4 max-xl:size-10 max-xl:self-center max-xl:px-0">
        <Link href="/?compose=1" aria-label="Новий допис">
          <PenSquare />
          <span className="hidden xl:inline">Новий допис</span>
        </Link>
      </Button>

      <Link
        href={me.username ? `/${me.username}` : "#"}
        className="mt-auto flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-subtle max-xl:justify-center"
      >
        <UserAvatar user={me} size="md" showOnline />
        <span className="hidden min-w-0 flex-1 xl:block">
          <span className="block truncate text-sm font-medium">{me.name}</span>
          <span className="block truncate text-xs text-muted-foreground">@{me.username}</span>
        </span>
      </Link>
    </aside>
  )
}

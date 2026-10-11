"use client"

import Link from "next/link"
import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { isActive, navItems, withBadges } from "./nav-items"
import { useUnreadCounts } from "@/hooks/useUnreadCounts"

const mobileItems = navItems.filter((i) =>
  ["/", "/explore", "/communities", "/messages", "/notifications"].includes(i.href)
)

export function MobileNav() {
  return (
    <Suspense fallback={<MobileNavInner pathname={null} />}>
      <ActiveMobileNav />
    </Suspense>
  )
}

function ActiveMobileNav() {
  return <MobileNavInner pathname={usePathname()} />
}

function MobileNavInner({ pathname }: { pathname: string | null }) {
  const unread = useUnreadCounts(pathname)
  return (
    <nav
      aria-label="Мобільна навігація"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex h-14 max-w-md items-center justify-around">
        {withBadges(mobileItems, unread).map((item) => {
          const active = pathname !== null && isActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex size-11 items-center justify-center rounded-full transition-colors",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.7} />
                {item.badge ? (
                  <span className="absolute top-2 right-2 size-2 rounded-full bg-brand ring-2 ring-background" />
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

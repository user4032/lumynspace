"use client"

import Link from "next/link"
import { Bell, LogOut, PenSquare, Search, Info, Settings, Shield, Ticket, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Logo } from "@/components/logo"
import { ThemeSwitcher, ThemeToggle } from "@/components/theme-toggle"
import { UserAvatar } from "@/components/user-avatar"
import { useMe, viewerActions } from "@/lib/viewer-store"
import { CloseFriendsIcon } from "@/components/icons"
import { isMockMode } from "@/lib/env"
import { signOut } from "@/lib/actions/auth"
import { Kbd, useCommandMenu } from "./command-menu"
import { useUnreadCounts } from "@/hooks/useUnreadCounts"

export function Header() {
  const { setOpen } = useCommandMenu()
  const me = useMe()
  const unread = useUnreadCounts(null)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/75 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-[1220px] items-center gap-3 px-4">
        <div className="flex shrink-0 items-center gap-2.5 md:w-[64px] xl:w-[232px]">
          <Link href="/" aria-label="Lumyn — на головну" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo className="md:max-xl:[&>span]:hidden" />
          </Link>
          {isMockMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden h-5 items-center rounded-full border px-2 font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase xl:inline-flex">
                  Демо
                </span>
              </TooltipTrigger>
              <TooltipContent>Supabase не налаштовано — працюють мок-дані</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex flex-1 justify-end sm:justify-center">
          <button
            onClick={() => setOpen(true)}
            aria-label="Пошук (⌘K)"
            className="group flex h-9 items-center gap-2.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground max-sm:size-8 max-sm:justify-center sm:w-full sm:max-w-[440px] sm:border sm:bg-subtle sm:px-3 sm:hover:border-input"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 truncate text-left sm:inline">Шукати в Lumyn…</span>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1 lg:w-[316px] lg:justify-end">
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" asChild className="relative">
                <Link href="/notifications" aria-label={unread.notifications ? `Сповіщення: ${unread.notifications} нових` : "Сповіщення"}>
                  <Bell />
                  {isMockMode && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand ring-2 ring-background" />}
                  {!isMockMode && unread.notifications > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[9px] font-semibold text-brand-foreground ring-2 ring-background tabular">
                      {unread.notifications > 99 ? "99+" : unread.notifications}
                    </span>
                  )}
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сповіщення</TooltipContent>
          </Tooltip>
          <Button size="sm" asChild className="ml-1 hidden sm:inline-flex xl:hidden">
            <Link href="/?compose=1">
              <PenSquare />
              Допис
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <UserAvatar user={me} size="md" className="size-8" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="px-2 py-2">
                <div className="text-sm font-medium text-foreground">{me.name}</div>
                <div className="text-xs font-normal text-muted-foreground">@{me.username}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href={`/${me.username}`}>
                    <User /> Профіль <DropdownMenuShortcut>⇧P</DropdownMenuShortcut>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings /> Налаштування <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/privacy">
                    <Shield /> Приватність і безпека
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/close-friends">
                    <CloseFriendsIcon className="text-close" /> Близькі друзі
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/welcome">
                  <Info /> Про Lumyn
                </Link>
              </DropdownMenuItem>
              {isMockMode && (
                <DropdownMenuItem asChild>
                  <Link href="/onboarding">
                    <Ticket /> Онбординг (демо)
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5 text-sm">
                <span className="text-muted-foreground">Тема</span>
                <ThemeSwitcher />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  // не лишаємо мій профіль у localStorage для наступного акаунта
                  if (!isMockMode) viewerActions.reset()
                  void signOut()
                }}
              >
                <LogOut /> Вийти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

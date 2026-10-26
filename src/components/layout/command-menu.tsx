"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { FileText, Hash, Laptop, Moon, PenSquare, Search, Sun, Users } from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { UserAvatar } from "@/components/user-avatar"
import { communities, trends, users } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { useMe, useViewer } from "@/lib/viewer-store"
import { quickSearch } from "@/lib/actions/search"
import { VerifiedBadge } from "@/components/verified-badge"

type Remote = Awaited<ReturnType<typeof quickSearch>>
const EMPTY: Remote = { people: [], communities: [], posts: [] }
import { navItems, withMyProfile } from "./nav-items"

type Ctx = { open: boolean; setOpen: (v: boolean) => void }
const CommandMenuContext = React.createContext<Ctx>({ open: false, setOpen: () => {} })
export const useCommandMenu = () => React.useContext(CommandMenuContext)

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <CommandMenuContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandMenu open={open} setOpen={setOpen} />
    </CommandMenuContext.Provider>
  )
}

function CommandMenu({ open, setOpen }: Ctx) {
  const router = useRouter()
  const { setTheme } = useTheme()
  const me = useMe()
  const livePeople = useViewer((s) => s.people)
  const [query, setQuery] = React.useState("")
  const [remote, setRemote] = React.useState<Remote>(EMPTY)
  const q = query.trim()

  // Supabase: пошук по всіх профілях, спільнотах і дописах (з затримкою 250 мс)
  React.useEffect(() => {
    if (isMockMode || q.length < 2) return
    let alive = true
    const t = setTimeout(() => {
      quickSearch(q)
        .then((r) => alive && setRemote(r))
        .catch(() => {})
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])
  const found = !isMockMode && q.length >= 2 ? remote : EMPTY

  // люди, яких я читаю + знайдені
  const follows = isMockMode ? users.slice(1) : (livePeople ?? [])
  const people = [...follows, ...found.people.filter((u) => !follows.some((f) => f.id === u.id))]
  // спільноти: демо або знайдені; тренди — лише в демо
  const demoCommunities = isMockMode ? communities : found.communities
  const demoTrends = isMockMode ? trends.slice(0, 3) : []

  const run = React.useCallback(
    (fn: () => void) => {
      setOpen(false)
      setQuery("")
      fn()
    },
    [setOpen]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setQuery("")
        setOpen(v)
      }}
      title="Командна палітра"
      description="Пошук людей, спільнот і швидкі дії"
    >
      <Command loop>
      <CommandInput value={query} onValueChange={setQuery} placeholder="Шукати людей, спільноти, дописи, команди…" />
      <CommandList>
        <CommandEmpty>Нічого не знайдено.</CommandEmpty>
        {!isMockMode && q.length >= 2 && (
          <CommandGroup heading="Пошук">
            <CommandItem value={`search ${q}`} keywords={[q]} onSelect={() => run(() => router.push(`/explore?q=${encodeURIComponent(q)}`))}>
              <Search />
              Шукати «{q}» в огляді
            </CommandItem>
          </CommandGroup>
        )}
        <CommandGroup heading="Навігація">
          {withMyProfile(navItems, me.username).map((item) => (
            <CommandItem key={item.href} value={`nav ${item.label}`} onSelect={() => run(() => router.push(item.href))}>
              <item.icon />
              {item.label}
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
          <CommandItem value="new post новий допис" onSelect={() => run(() => router.push("/?compose=1"))}>
            <PenSquare />
            Новий допис
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        {people.length > 0 && (
        <CommandGroup heading="Люди">
          {people.map((u) => (
            <CommandItem key={u.id} value={`user ${u.name} ${u.username}`} keywords={found.people.some((f) => f.id === u.id) ? [q] : undefined} onSelect={() => run(() => router.push(`/${u.username}`))}>
              <UserAvatar user={u} size="xs" />
              <span className="flex items-center gap-1">{u.name}{"verified" in u && u.verified && <VerifiedBadge className="size-3.5" />}</span>
              <span className="text-muted-foreground">@{u.username}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        )}
        {found.posts.length > 0 && (
        <CommandGroup heading="Дописи">
          {found.posts.map((p) => (
            <CommandItem key={p.id} value={`post ${p.id}`} keywords={[q]} onSelect={() => run(() => router.push(`/post/${p.id}`))}>
              <FileText />
              <span className="truncate">{p.content}</span>
              <span className="shrink-0 text-muted-foreground">@{p.author}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        )}
        {demoCommunities.length > 0 && (
        <CommandGroup heading="Спільноти">
          {demoCommunities.map((c) => (
            <CommandItem key={c.id} value={`community ${c.name} ${c.slug}`} keywords={isMockMode ? undefined : [q]} onSelect={() => run(() => router.push(`/c/${c.slug}`))}>
              <Users />
              <span>{c.name}</span>
              <span className="text-muted-foreground">c/{c.slug}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        )}
        {demoTrends.length > 0 && (
        <CommandGroup heading="Тренди">
          {demoTrends.map((t) => (
            <CommandItem key={t.tag} value={`trend ${t.tag}`} onSelect={() => run(() => router.push(`/explore?q=${encodeURIComponent("#" + t.tag)}`))}>
              <Hash />
              {t.tag}
            </CommandItem>
          ))}
        </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Тема">
          <CommandItem value="theme light світла тема" onSelect={() => run(() => setTheme("light"))}>
            <Sun /> Світла тема
          </CommandItem>
          <CommandItem value="theme dark темна тема" onSelect={() => run(() => setTheme("dark"))}>
            <Moon /> Темна тема
          </CommandItem>
          <CommandItem value="theme system системна тема" onSelect={() => run(() => setTheme("system"))}>
            <Laptop /> Як у системі
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t bg-subtle px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> вибір</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> відкрити</span>
        </span>
        <span className="flex items-center gap-1"><Kbd>esc</Kbd> закрити</span>
      </div>
      </Command>
    </CommandDialog>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-background px-1 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  )
}

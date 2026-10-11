import {
  Bell,
  Compass,
  House,
  MessageSquare,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"
import { currentUser } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: number
  shortcut?: string
  /** посилання на мій профіль — підставляється нік (див. withMyProfile) */
  me?: boolean
}

export const navItems: NavItem[] = [
  { href: "/", label: "Головна", icon: House, shortcut: "G H" },
  { href: "/explore", label: "Огляд", icon: Compass, shortcut: "G E" },
  { href: "/communities", label: "Спільноти", icon: Users, shortcut: "G C" },
  { href: "/messages", label: "Повідомлення", icon: MessageSquare, badge: isMockMode ? 3 : undefined, shortcut: "G M" },
  { href: "/notifications", label: "Сповіщення", icon: Bell, badge: isMockMode ? 4 : undefined, shortcut: "G N" },
  { href: `/${currentUser.username}`, label: "Профіль", icon: User, shortcut: "G P", me: true },
  { href: "/settings", label: "Налаштування", icon: Settings, shortcut: "G S" },
]

/** Профіль веде на мій справжній нік (із Supabase він відомий лише після завантаження) */
export function withMyProfile(items: NavItem[], username: string): NavItem[] {
  if (isMockMode || !username) return items
  return items.map((i) => (i.me ? { ...i, href: `/${username}` } : i))
}

/** Supabase: живі лічильники непрочитаного на «Повідомлення» / «Сповіщення» */
export function withBadges(items: NavItem[], counts: { messages: number; notifications: number }): NavItem[] {
  if (isMockMode) return items
  return items.map((i) =>
    i.href === "/messages" ? { ...i, badge: counts.messages || undefined } : i.href === "/notifications" ? { ...i, badge: counts.notifications || undefined } : i
  )
}

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

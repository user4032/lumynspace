"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { Music2 } from "lucide-react"
import type { User } from "@/types"
import { UserAvatar } from "@/components/user-avatar"
import { users, currentUser } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"

// демо-люди лише в демо-режимі; із Supabase — тільки pool із БД
const byId = new Map<string, User>(isMockMode ? [currentUser, ...users].map((u) => [u.id, u]) : [])
export const resolveUsers = (ids: string[] | undefined, pool: User[] = []) => {
  const fromPool = new Map(pool.map((u) => [u.id, u]))
  return (ids ?? []).map((id) => fromPool.get(id) ?? byId.get(id)).filter((u): u is User => Boolean(u)).slice(0, 4)
}

/** «Топ-4»: чотири найближчі люди — привіт MySpace */
export function TopFour({ ids, pool }: { ids?: string[]; pool?: User[] }) {
  const reduce = useReducedMotion()
  const list = resolveUsers(ids, pool)
  if (!list.length) return null
  return (
    <section className="rounded-xl border bg-card/60 p-3">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="font-mono text-[var(--accent-user)]">04</span> Топ-4
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {list.map((u, i) => (
          <motion.div
            key={u.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.25 }}
          >
            <Link href={`/${u.username}`} className="group flex flex-col items-center gap-1.5 text-center">
              <span className="relative">
                <UserAvatar user={u} size="xl" className="size-12 transition-transform duration-200 group-hover:scale-105" />
                <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-background font-mono text-[9px] font-semibold ring-1 ring-border">
                  {i + 1}
                </span>
              </span>
              <span className="w-full truncate text-[11px] text-muted-foreground group-hover:text-foreground">{u.name.split(" ")[0]}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/** «Зараз грає» з еквалайзером в акценті профілю */
export function NowPlaying({ track }: { track?: { title: string; artist: string } | null }) {
  if (!track?.title) return null
  return (
    <section className="flex items-center gap-3 rounded-xl border bg-card/60 p-3">
      <span
        className="grid size-12 shrink-0 place-items-center rounded-lg"
        style={{ background: "linear-gradient(135deg, var(--accent-user), color-mix(in oklab, var(--accent-user) 35%, #000))" }}
      >
        <Music2 className="size-5 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-muted-foreground">Зараз грає</span>
        <span className="block truncate text-sm font-medium">{track.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
      </span>
      <span className="eq flex h-5 items-end gap-[3px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="w-[3px] rounded-full bg-[var(--accent-user)]" style={{ animationDelay: `${-i * 0.27}s` }} />
        ))}
      </span>
    </section>
  )
}

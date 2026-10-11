"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { useViewer } from "@/lib/viewer-store"
import { ProfileView } from "./profile-view"

/**
 * Демо-режим: нік, обраний в онбордингу, живе лише в localStorage,
 * тому сервер не знає /новий-нік. Якщо збігається з моїм — показуємо мій профіль.
 */
export function MockMeOr404({ username, ...props }: { username: string } & Omit<ComponentProps<typeof ProfileView>, "isMe">) {
  const myHandle = useViewer((s) => s.profile.username)
  if (myHandle.toLowerCase() === username.toLowerCase()) return <ProfileView {...props} isMe />
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">@{username} не знайдено</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Можливо, нік змінився або профіль видалено.</p>
      <Button asChild size="sm" variant="secondary" className="mt-5 rounded-full">
        <Link href="/">На головну</Link>
      </Button>
    </div>
  )
}

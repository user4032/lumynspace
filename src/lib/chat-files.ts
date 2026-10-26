"use client"

import { useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { ChatAttachment } from "@/types"

export const CHAT_BUCKET = "chat-files"
export const CHAT_FILE_LIMIT = 25 * 1024 * 1024
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

/** Старі повідомлення: публічне посилання Supabase Storage на картинку замість вкладення */
export const LEGACY_IMAGE_RE = /https:\/\/[^\s]+\/storage\/v1\/object\/public\/[^\s]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s]*)?/gi

export function formatBytes(n: number) {
  if (n < 1024) return `${n} Б`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`
  return `${(n / 1024 / 1024).toFixed(1)} МБ`
}

function imageDims(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({})
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/** Приватне вкладення: <conversation>/<me>/<uuid>-<name>. Читати можуть лише учасники (RLS). */
export async function uploadChatFile(
  conversationId: string,
  file: File,
  opts?: { duration?: number }
): Promise<{ ok: true; attachment: ChatAttachment } | { ok: false; error: string }> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { ok: false, error: "Вкладення доступні лише з Supabase" }
  if (file.size > CHAT_FILE_LIMIT) return { ok: false, error: "Файл завеликий (максимум 25 МБ)" }
  const { data: claims } = await supabase.auth.getClaims()
  const uid = claims?.claims?.sub as string | undefined
  if (!uid) return { ok: false, error: "Увійдіть" }
  const safe = file.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80) || "file"
  const path = `${conversationId}/${uid}/${crypto.randomUUID()}-${safe}`
  const mime = file.type || "application/octet-stream"
  const { error } = await supabase.storage.from(CHAT_BUCKET).upload(path, file, { contentType: mime, upsert: false })
  if (error) return { ok: false, error: /bucket/i.test(error.message) ? "Сховище чату ще не налаштоване (apply-pending-3.sql)" : error.message }
  const isImage = IMAGE_TYPES.includes(mime)
  const isAudio = mime.startsWith("audio/")
  return {
    ok: true,
    attachment: {
      kind: isImage ? "image" : isAudio ? "audio" : "file",
      path,
      name: file.name.slice(0, 200),
      size: file.size,
      mime,
      ...(isImage ? await imageDims(file) : {}),
      ...(isAudio && opts?.duration ? { duration: Math.round(opts.duration) } : {}),
    },
  }
}

/** Підписані посилання (1 год) для вкладень. Кешуються в межах сесії сторінки. */
const cache = new Map<string, { url: string; exp: number }>()
export function useSignedUrls(paths: string[]): Record<string, string> {
  const key = [...new Set(paths.filter(Boolean))].sort().join("|")
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const list = key ? key.split("|") : []
    const now = Date.now()
    const fresh: Record<string, string> = {}
    const missing = list.filter((p) => {
      const c = cache.get(p)
      if (c && c.exp > now) fresh[p] = c.url
      return !(c && c.exp > now)
    })
    let cancelled = false
    const supabase = getSupabaseBrowserClient()
    if (!missing.length || !supabase) {
      queueMicrotask(() => !cancelled && setUrls(fresh))
      return () => {
        cancelled = true
      }
    }
    void supabase.storage
      .from(CHAT_BUCKET)
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        for (const r of data ?? []) {
          if (r.path && r.signedUrl) {
            cache.set(r.path, { url: r.signedUrl, exp: now + 3_300_000 })
            fresh[r.path] = r.signedUrl
          }
        }
        if (!cancelled) setUrls(fresh)
      })
    return () => {
      cancelled = true
    }
  }, [key])
  return urls
}

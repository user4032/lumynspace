"use client"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"

/** Бакети Supabase Storage (міграції 0001 + 0004). Шлях файлу завжди <uid>/<uuid>.<ext>. */
export type MediaBucket = "avatars" | "covers" | "post-media" | "community-media"

const LIMITS: Record<MediaBucket, number> = {
  avatars: 5 * 1024 * 1024,
  covers: 5 * 1024 * 1024,
  "post-media": 10 * 1024 * 1024,
  "community-media": 5 * 1024 * 1024,
}
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
export const IMAGE_ACCEPT = TYPES.join(",")
/** Відео в дописах (бакет post-media, міграція 0009): до 50 МБ */
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
export const VIDEO_LIMIT = 50 * 1024 * 1024
export const POST_MEDIA_ACCEPT = [...TYPES, ...VIDEO_TYPES].join(",")
export const isVideoFile = (file: File) => VIDEO_TYPES.includes(file.type)

export type UploadResult = { ok: true; url: string; path: string } | { ok: false; error: string }

/** Завантажує фото у власну теку користувача й повертає публічне посилання. */
export async function uploadImage(bucket: MediaBucket, file: File): Promise<UploadResult> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return { ok: false, error: "Завантаження доступне лише з Supabase" }
  const video = bucket === "post-media" && isVideoFile(file)
  if (video && file.size > VIDEO_LIMIT) return { ok: false, error: "Відео завелике (максимум 50 МБ)" }
  if (!video && (!TYPES.includes(file.type) || (bucket !== "post-media" && bucket !== "avatars" && file.type === "image/gif")))
    return { ok: false, error: "Підтримуються JPG, PNG, WebP" + (bucket === "post-media" || bucket === "avatars" ? " і GIF" : "") }
  if (!video && file.size > LIMITS[bucket]) return { ok: false, error: `Файл завеликий (максимум ${LIMITS[bucket] / 1024 / 1024} МБ)` }

  const { data: claims } = await supabase.auth.getClaims()
  const uid = claims?.claims?.sub as string | undefined
  if (!uid) return { ok: false, error: "Увійдіть, щоб завантажувати фото" }

  const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg").replace("quicktime", "mov")
  const path = `${uid}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false })
  if (error) return { ok: false, error: error.message }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { ok: true, url: data.publicUrl, path }
}

/** Розміри відео (метадані), без завантаження всього файлу */
export function videoSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement("video")
    v.preload = "metadata"
    v.onloadedmetadata = () => {
      resolve({ width: v.videoWidth || 1280, height: v.videoHeight || 720 })
      URL.revokeObjectURL(url)
    }
    v.onerror = () => {
      resolve({ width: 1280, height: 720 })
      URL.revokeObjectURL(url)
    }
    v.src = url
  })
}

/** Розміри зображення (для media.width/height). */
export function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth || 1200, height: img.naturalHeight || 800 })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 1200, height: 800 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/** Видаляє всі мої файли з усіх бакетів (перед видаленням акаунта). */
export async function removeAllMyFiles(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return
  const { data: claims } = await supabase.auth.getClaims()
  const uid = claims?.claims?.sub as string | undefined
  if (!uid) return
  for (const bucket of Object.keys(LIMITS) as MediaBucket[]) {
    for (;;) {
      const { data } = await supabase.storage.from(bucket).list(uid, { limit: 100 })
      if (!data?.length) break
      const { error } = await supabase.storage.from(bucket).remove(data.map((f) => `${uid}/${f.name}`))
      if (error || data.length < 100) break
    }
  }
}

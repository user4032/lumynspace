"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import type { ActionResult } from "./posts"
import type { PostAudience, StoryActor, StoryGroup, StoryInsights } from "@/types"
import { STORY_REACTIONS } from "@/lib/stories"
import { sendMessage, startDirectConversation } from "./social"

const UUID_RE = /^[0-9a-f-]{36}$/i

/** Підказка, якщо 0024 ще не застосовано (таблиці взаємодій відсутні). */
function schemaError(error: { code?: string; message: string }) {
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205" || error.code === "PGRST204") {
    return "Взаємодії зі сторіс ще не налаштовані: запустіть apply-pending-18.sql"
  }
  return error.message
}

type ProfileLite = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  verified?: boolean
  frame?: string | null
  frame_expires_at?: string | null
}

function toActor(p: ProfileLite | undefined, id: string): StoryActor {
  return {
    id,
    username: p?.username ?? "user",
    name: p?.display_name || p?.username || "Користувач",
    avatarUrl: p?.avatar_url ?? null,
    verified: p?.verified ?? false,
  }
}

/** Живі сторіс, згруповані за автором: спершу моя, потім непереглянуті (свіжіші вище), потім переглянуті. */
export async function getStoryFeed(): Promise<ActionResult<StoryGroup[]>> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: [] }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }

  const { data: rows, error } = await supabase
    .from("stories")
    .select("id, author_id, media_url, mime, duration_sec, caption, created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(200)
  if (error) return { ok: false, error: error.message }

  const list = (rows ?? []) as {
    id: string
    author_id: string
    media_url: string
    mime: string
    duration_sec: number
    caption: string | null
    created_at: string
  }[]
  if (!list.length) return { ok: true, data: [] }

  const ids = list.map((s) => s.id)
  const [profRes, viewsRes, lightsRes, reactionsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, verified, frame, frame_expires_at")
      .in("id", [...new Set(list.map((s) => s.author_id))]),
    supabase.from("story_views").select("story_id, viewer_id").in("story_id", ids),
    // 0024 може бути ще не застосовано — тоді просто без взаємодій
    supabase.from("story_lights").select("story_id, user_id").in("story_id", ids),
    supabase.from("story_reactions").select("story_id, user_id, emoji").in("story_id", ids),
  ])

  const viewed = (viewsRes.data ?? []) as { story_id: string; viewer_id: string }[]
  const lights = (lightsRes.data ?? []) as { story_id: string; user_id: string }[]
  const reactions = (reactionsRes.data ?? []) as { story_id: string; user_id: string; emoji: string }[]

  const seen = new Set(viewed.filter((v) => v.viewer_id === me).map((v) => v.story_id))
  const viewCount = new Map<string, number>()
  for (const v of viewed) viewCount.set(v.story_id, (viewCount.get(v.story_id) ?? 0) + 1)
  const lightCount = new Map<string, number>()
  const litByMe = new Set<string>()
  for (const l of lights) {
    lightCount.set(l.story_id, (lightCount.get(l.story_id) ?? 0) + 1)
    if (l.user_id === me) litByMe.add(l.story_id)
  }
  const reactionCount = new Map<string, number>()
  const myReaction = new Map<string, string>()
  for (const r of reactions) {
    reactionCount.set(r.story_id, (reactionCount.get(r.story_id) ?? 0) + 1)
    if (r.user_id === me) myReaction.set(r.story_id, r.emoji)
  }

  const profs = new Map(((profRes.data ?? []) as ProfileLite[]).map((p) => [p.id, p]))

  const groups = new Map<string, StoryGroup>()
  for (const s of list) {
    const p = profs.get(s.author_id)
    if (!p) continue
    const g =
      groups.get(s.author_id) ??
      ({
        author: {
          id: p.id,
          username: p.username,
          name: p.display_name || p.username,
          avatarUrl: p.avatar_url,
          verified: p.verified ?? false,
          frame: p.frame ?? null,
          frameExpiresAt: p.frame_expires_at ?? null,
        },
        isMe: s.author_id === me,
        stories: [],
      } satisfies StoryGroup)
    g.stories.push({
      id: s.id,
      mediaUrl: s.media_url,
      mime: s.mime,
      durationSec: s.duration_sec,
      caption: s.caption,
      createdAt: s.created_at,
      seen: s.author_id === me || seen.has(s.id),
      viewCount: viewCount.get(s.id) ?? 0,
      lightCount: lightCount.get(s.id) ?? 0,
      reactionCount: reactionCount.get(s.id) ?? 0,
      litByMe: litByMe.has(s.id),
      myReaction: myReaction.get(s.id) ?? null,
    })
    groups.set(s.author_id, g)
  }

  const all = [...groups.values()]
  const unseenFreshness = (g: StoryGroup) => Math.max(...g.stories.map((s) => Date.parse(s.createdAt)))
  const mine = all.filter((g) => g.isMe)
  const unseen = all.filter((g) => !g.isMe && g.stories.some((s) => !s.seen)).sort((a, b) => unseenFreshness(b) - unseenFreshness(a))
  const seenG = all.filter((g) => !g.isMe && g.stories.every((s) => s.seen)).sort((a, b) => unseenFreshness(b) - unseenFreshness(a))
  return { ok: true, data: [...mine, ...unseen, ...seenG] }
}

export async function createStory(input: {
  mediaUrl: string
  mime: string
  durationSec?: number
  caption?: string
  audience?: PostAudience
  circleId?: string | null
}): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }
  if (!/^https:\/\//.test(input.mediaUrl)) return { ok: false, error: "Некоректне медіа" }

  const { error } = await supabase.from("stories").insert({
    author_id: me,
    media_url: input.mediaUrl,
    mime: input.mime.slice(0, 100),
    duration_sec: Math.min(60, Math.max(3, Math.round(input.durationSec ?? 5))),
    caption: (input.caption ?? "").slice(0, 200) || null,
    audience: input.audience ?? "public",
    circle_id: input.audience === "circle" ? (input.circleId ?? null) : null,
  } as never)
  if (error?.code === "42P01") return { ok: false, error: "Сторіс ще не налаштовано: запустіть apply-pending-9.sql" }
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function deleteStory(storyId: string): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }
  const { error } = await supabase.from("stories").delete().eq("id", storyId).eq("author_id", me)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Позначити сторіс переглянутими (сірі кола). */
export async function markStoriesSeen(storyIds: string[]): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }
  const rows = storyIds
    .filter((id) => UUID_RE.test(id))
    .slice(0, 50)
    .map((story_id) => ({ story_id, viewer_id: me }))
  if (!rows.length) return { ok: true }
  const { error } = await supabase.from("story_views").upsert(rows as never, { onConflict: "story_id,viewer_id", ignoreDuplicates: true })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Поставити / зняти «світло» на сторіс. Повертає новий стан і кількість. */
export async function toggleStoryLight(storyId: string): Promise<ActionResult<{ on: boolean; count: number }>> {
  if (!UUID_RE.test(storyId)) return { ok: false, error: "Некоректна історія" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: { on: true, count: 0 } }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }

  const { data: existing, error } = await supabase
    .from("story_lights")
    .select("story_id")
    .eq("story_id", storyId)
    .eq("user_id", me)
    .maybeSingle()
  if (error) return { ok: false, error: schemaError(error) }

  if (existing) {
    const { error: delError } = await supabase.from("story_lights").delete().eq("story_id", storyId).eq("user_id", me)
    if (delError) return { ok: false, error: schemaError(delError) }
  } else {
    const { error: insError } = await supabase.from("story_lights").insert({ story_id: storyId, user_id: me } as never)
    if (insError) return { ok: false, error: schemaError(insError) }
  }

  const { count } = await supabase.from("story_lights").select("*", { count: "exact", head: true }).eq("story_id", storyId)
  return { ok: true, data: { on: !existing, count: count ?? 0 } }
}

/** Поставити / змінити / зняти реакцію на сторіс (одна на користувача). */
export async function setStoryReaction(storyId: string, emoji: string | null): Promise<ActionResult<{ emoji: string | null }>> {
  if (!UUID_RE.test(storyId)) return { ok: false, error: "Некоректна історія" }
  const next = emoji && (STORY_REACTIONS as readonly string[]).includes(emoji) ? emoji : null
  if (emoji && !next) return { ok: false, error: "Невідома реакція" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: { emoji: next } }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }

  if (!next) {
    const { error } = await supabase.from("story_reactions").delete().eq("story_id", storyId).eq("user_id", me)
    return error ? { ok: false, error: schemaError(error) } : { ok: true, data: { emoji: null } }
  }

  const { error } = await supabase
    .from("story_reactions")
    .upsert({ story_id: storyId, user_id: me, emoji: next } as never, { onConflict: "story_id,user_id" })
  return error ? { ok: false, error: schemaError(error) } : { ok: true, data: { emoji: next } }
}

/** Статистика власного сторіс: хто дивився, хто світив і які реакції. */
export async function getStoryInsights(storyId: string): Promise<ActionResult<StoryInsights>> {
  if (!UUID_RE.test(storyId)) return { ok: false, error: "Некоректна історія" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: { views: [], lights: [], reactions: [] } }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }

  const { data: story, error } = await supabase.from("stories").select("id, author_id").eq("id", storyId).maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!story) return { ok: false, error: "Історію не знайдено" }
  if ((story as { author_id: string }).author_id !== me) return { ok: false, error: "Статистику бачить лише автор" }

  const [viewsRes, lightsRes, reactionsRes] = await Promise.all([
    supabase.from("story_views").select("viewer_id, viewed_at").eq("story_id", storyId).order("viewed_at", { ascending: false }).limit(200),
    supabase.from("story_lights").select("user_id, created_at").eq("story_id", storyId).order("created_at", { ascending: false }).limit(200),
    supabase.from("story_reactions").select("user_id, emoji, created_at").eq("story_id", storyId).order("created_at", { ascending: false }).limit(200),
  ])
  const firstError = viewsRes.error ?? lightsRes.error ?? reactionsRes.error
  if (firstError) return { ok: false, error: schemaError(firstError) }

  const views = (viewsRes.data ?? []) as { viewer_id: string; viewed_at: string }[]
  const lights = (lightsRes.data ?? []) as { user_id: string; created_at: string }[]
  const reactions = (reactionsRes.data ?? []) as { user_id: string; emoji: string; created_at: string }[]

  const ids = [...new Set([...views.map((v) => v.viewer_id), ...lights.map((l) => l.user_id), ...reactions.map((r) => r.user_id)])]
  const profRes = ids.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url, verified").in("id", ids)
    : { data: [] as ProfileLite[] }
  const profs = new Map(((profRes.data ?? []) as ProfileLite[]).map((p) => [p.id, p]))

  const byEmoji = new Map<string, StoryActor[]>()
  for (const r of reactions) {
    const list = byEmoji.get(r.emoji) ?? []
    list.push(toActor(profs.get(r.user_id), r.user_id))
    byEmoji.set(r.emoji, list)
  }

  return {
    ok: true,
    data: {
      views: views.map((v) => ({ user: toActor(profs.get(v.viewer_id), v.viewer_id), at: v.viewed_at })),
      lights: lights.map((l) => ({ user: toActor(profs.get(l.user_id), l.user_id), at: l.created_at })),
      reactions: [...byEmoji.entries()].map(([emoji, users]) => ({ emoji, users })).sort((a, b) => b.users.length - a.users.length),
    },
  }
}

/** Одне сторіс для перегляду з чату (клік по прев'ю у відповіді). */
export async function getStoryThread(storyId: string): Promise<ActionResult<StoryGroup | null>> {
  if (!UUID_RE.test(storyId)) return { ok: false, error: "Некоректна історія" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: null }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }

  const { data, error } = await supabase
    .from("stories")
    .select("id, author_id, media_url, mime, duration_sec, caption, created_at")
    .eq("id", storyId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: true, data: null }
  const s = data as {
    id: string
    author_id: string
    media_url: string
    mime: string
    duration_sec: number
    caption: string | null
    created_at: string
  }

  const [profRes, viewsRes, lightsRes, reactionsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, verified, frame, frame_expires_at")
      .eq("id", s.author_id)
      .maybeSingle(),
    supabase.from("story_views").select("viewer_id").eq("story_id", s.id),
    supabase.from("story_lights").select("user_id").eq("story_id", s.id),
    supabase.from("story_reactions").select("user_id, emoji").eq("story_id", s.id),
  ])
  const p = profRes.data as ProfileLite | null
  const views = (viewsRes.data ?? []) as { viewer_id: string }[]
  const lights = (lightsRes.data ?? []) as { user_id: string }[]
  const reactions = (reactionsRes.data ?? []) as { user_id: string; emoji: string }[]

  return {
    ok: true,
    data: {
      author: {
        id: s.author_id,
        username: p?.username ?? "user",
        name: p?.display_name || p?.username || "Користувач",
        avatarUrl: p?.avatar_url ?? null,
        verified: p?.verified ?? false,
        frame: p?.frame ?? null,
        frameExpiresAt: p?.frame_expires_at ?? null,
      },
      isMe: s.author_id === me,
      stories: [
        {
          id: s.id,
          mediaUrl: s.media_url,
          mime: s.mime,
          durationSec: s.duration_sec,
          caption: s.caption,
          createdAt: s.created_at,
          seen: s.author_id === me || views.some((v) => v.viewer_id === me),
          viewCount: views.length,
          lightCount: lights.length,
          reactionCount: reactions.length,
          litByMe: lights.some((l) => l.user_id === me),
          myReaction: reactions.find((r) => r.user_id === me)?.emoji ?? null,
        },
      ],
    },
  }
}

/** Відповідь на сторіс: створює/знаходить DM з автором і надсилає туди текст. */
export async function replyToStory(storyId: string, text: string): Promise<ActionResult<string>> {
  if (!UUID_RE.test(storyId)) return { ok: false, error: "Некоректна історія" }
  const body = text.trim().slice(0, 1000)
  if (!body) return { ok: false, error: "Порожня відповідь" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  if (!me) return { ok: false, error: "Увійдіть" }

  const { data: story, error } = await supabase.from("stories").select("author_id").eq("id", storyId).maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!story) return { ok: false, error: "Історію не знайдено" }
  const authorId = (story as { author_id: string }).author_id
  if (authorId === me) return { ok: false, error: "Це ваша історія" }

  const conv = await startDirectConversation(authorId)
  if (!conv.ok) return { ok: false, error: conv.error }
  if (!conv.data) return { ok: true, mock: true }
  return sendMessage(conv.data, body, [], null, storyId)
}

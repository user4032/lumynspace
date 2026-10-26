"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { pushToUser } from "@/lib/push"
import { PUBLIC_PROFILE_COLUMNS, profileRowToUser, type PublicProfileRow } from "@/lib/profiles"
import { mapFeedRow } from "@/lib/feed-map"
import { profileHandleFromUrl } from "@/lib/link-embeds"
import type { ActionResult } from "./posts"
import type { ChatAttachment } from "@/types"
import type { FeedPostRow } from "@/types/database"

/** Кандидат «Кого читати» в онбордингу */
export type SuggestedUser = {
  id: string
  username: string
  name: string
  bio: string
  avatarUrl: string | null
  accentColor: string
  isPrivate: boolean
  verified: boolean
}

/** Підбір людей для кроку «Кого читати»: популярні онбординг-профілі, без мене і вже прочитаних. */
export async function getSuggestedPeople(limit = 8): Promise<ActionResult<SuggestedUser[]>> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: [] }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }

  const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", me).limit(500)
  const skip = new Set<string>([me, ...((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)])

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, accent_color, is_private, verified, followers_count")
    .not("onboarded_at", "is", null)
    .order("followers_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60)
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: ((data ?? []) as {
      id: string
      username: string
      display_name: string
      bio: string
      avatar_url: string | null
      accent_color: string
      is_private: boolean
      verified?: boolean
    }[])
      .filter((r) => !skip.has(r.id))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        username: r.username,
        name: r.display_name || r.username,
        bio: r.bio ?? "",
        avatarUrl: r.avatar_url,
        accentColor: r.accent_color,
        isPrivate: r.is_private,
        verified: r.verified ?? false,
      })),
  }
}

/** Групова розмова: назва + учасники (RLS: створює будь-хто, учасників додає творець). */
export async function createGroupConversation(title: string, memberIds: string[]): Promise<ActionResult<string>> {
  const name = title.trim().slice(0, 80)
  if (!name) return { ok: false, error: "Назва групи порожня" }
  const members = [...new Set(memberIds.filter(Boolean))].slice(0, 50)
  if (!members.length) return { ok: false, error: "Оберіть хоча б одну людину" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ is_group: true, title: name, created_by: me } as never)
    .select("id")
    .single()
  if (error || !conv) return { ok: false, error: error?.message ?? "Не вдалося створити групу" }
  const id = (conv as { id: string }).id

  // творця додає тригер conversations_add_creator — вставляємо лише решту,
  // on conflict — захист від подвійного кліку/ретраю
  const rows = members.filter((m) => m !== me).map((user_id) => ({ conversation_id: id, user_id }))
  const { error: memberErr } = await supabase
    .from("conversation_members")
    .upsert(rows as never, { onConflict: "conversation_id,user_id", ignoreDuplicates: true })
  if (memberErr) return { ok: false, error: memberErr.message }
  return { ok: true, data: id }
}

/** Вийти з групи (свій рядок conversation_members; RLS дозволяє лише свій). */
export async function leaveGroup(conversationId: string): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  const { error } = await supabase.from("conversation_members").delete().match({ conversation_id: conversationId, user_id: me })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function toggleFollow(targetUserId: string, follow: boolean): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 300))
    return { ok: true, mock: true }
  }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть, щоб підписуватися" }
  if (me === targetUserId) return { ok: false, error: "Не можна підписатися на себе" }

  const { error } = follow
    ? await supabase.from("follows").insert({ follower_id: me, following_id: targetUserId })
    : await supabase.from("follows").delete().match({ follower_id: me, following_id: targetUserId })
  if (error) return { ok: false, error: error.message }

  // push: «вас читають» (публічний) / «запит на підписку» (приватний)
  if (follow) {
    const { data: target } = await supabase.from("profiles").select("is_private, display_name, username").eq("id", targetUserId).maybeSingle()
    const t = target as { is_private?: boolean; display_name?: string; username?: string } | null
    const name = t?.display_name || t?.username || "Хтось"
    void pushToUser(targetUserId, {
      title: t?.is_private ? "Запит на підписку" : "Новий читач",
      body: t?.is_private ? `${name} хоче читати вас` : `${name} тепер читає вас`,
      url: "/notifications",
      tag: "follow",
    })
  }
  return { ok: true }
}

export async function joinCommunity(communityId: string, join: boolean): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 300))
    return { ok: true, mock: true }
  }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть, щоб вступити" }

  if (join) {
    const { error } = await supabase.from("community_members").insert({ community_id: communityId, user_id: me })
    if (error?.code === "42501") return { ok: false, error: "Це приватна спільнота — надішліть запит" }
    return error ? { ok: false, error: error.message } : { ok: true }
  }
  const { data: left, error } = await supabase
    .from("community_members")
    .delete()
    .match({ community_id: communityId, user_id: me })
    .select("user_id")
  if (error) return { ok: false, error: error.message }
  // RLS не дає власнику вийти (видалено 0 рядків)
  if (!left?.length) return { ok: false, error: "Власник не може вийти зі своєї спільноти" }
  return { ok: true }
}

export async function sendMessage(
  conversationId: string,
  content: string,
  attachments: ChatAttachment[] = [],
  replyTo?: string | null,
  storyId?: string | null
): Promise<ActionResult<string>> {
  const text = content.trim()
  if (!text && !attachments.length && !storyId) return { ok: false, error: "Порожнє повідомлення" }
  if (attachments.length > 10) return { ok: false, error: "Не більше 10 вкладень" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть, щоб писати" }

  if (text.length > 4000) return { ok: false, error: "Максимум 4000 символів" }
  // вкладення лише з моєї теки цієї розмови (решту перевіряє RLS сховища)
  const clean = attachments
    .filter((a) => a.kind !== "story")
    .filter((a) => typeof a.path === "string" && a.path.startsWith(`${conversationId}/${me}/`) && !a.path.includes(".."))
    .map((a): ChatAttachment => ({
      kind: a.kind === "image" ? "image" : a.kind === "audio" ? "audio" : "file",
      path: a.path,
      name: String(a.name ?? "file").slice(0, 200),
      size: Math.max(0, Number(a.size) || 0),
      mime: String(a.mime ?? "application/octet-stream").slice(0, 100),
      ...(a.width && a.height ? { width: Math.round(a.width), height: Math.round(a.height) } : {}),
      ...(a.kind === "audio" && typeof a.duration === "number" ? { duration: Math.max(0, Math.round(a.duration)) } : {}),
    }))
  if (attachments.length && !clean.length && !storyId) return { ok: false, error: "Некоректне вкладення" }

  const all: ChatAttachment[] = [...clean]
  // відповідь на історію: знімок беремо з БД, а не з клієнта
  if (storyId) {
    if (!/^[0-9a-f-]{36}$/i.test(storyId)) return { ok: false, error: "Некоректна історія" }
    const { data: story } = await supabase
      .from("stories")
      .select("id, author_id, media_url, mime, duration_sec, caption, created_at")
      .eq("id", storyId)
      .maybeSingle()
    if (!story) return { ok: false, error: "Історія вже недоступна" }
    const row = story as {
      id: string
      author_id: string
      media_url: string
      mime: string
      duration_sec: number
      caption: string | null
      created_at: string
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", row.author_id)
      .maybeSingle()
    const p = prof as { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
    all.unshift({
      kind: "story",
      path: "",
      name: "Історія",
      size: 0,
      mime: row.mime,
      story: {
        id: row.id,
        mediaUrl: row.media_url,
        mime: row.mime,
        durationSec: row.duration_sec,
        caption: row.caption,
        createdAt: row.created_at,
        author: {
          id: row.author_id,
          username: p?.username ?? "user",
          name: p?.display_name || p?.username || "Користувач",
          avatarUrl: p?.avatar_url ?? null,
        },
      },
    })
  }

  const row0: Record<string, unknown> = { conversation_id: conversationId, sender_id: me, content: text }
  if (all.length) row0.attachments = all
  // відповідь на повідомлення тієї ж розмови (0014)
  if (replyTo && /^[0-9a-f-]{36}$/i.test(replyTo)) {
    const { data: target } = await supabase.from("messages").select("conversation_id").eq("id", replyTo).maybeSingle()
    if ((target as { conversation_id?: string } | null)?.conversation_id === conversationId) row0.reply_to = replyTo
  }
  const { data: row, error } = await supabase
    .from("messages")
    .insert(row0 as never)
    .select("id")
    .single()
  if (error?.code === "42501") return { ok: false, error: "Не можна написати: блокування або налаштування приватності" }
  if (error) return { ok: false, error: error.message }

  // push учасникам розмови (крім мене)
  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", me)
    .limit(20)
  const name = await (async () => {
    const { data: prof } = await supabase.from("profiles").select("display_name, username").eq("id", me).maybeSingle()
    const p = prof as { display_name?: string; username?: string } | null
    return p?.display_name || p?.username || "Хтось"
  })()
  for (const m of (members ?? []) as { user_id: string }[]) {
    void pushToUser(m.user_id, {
      title: name,
      body: text ? text.slice(0, 90) : "Надіслав вкладення",
      url: `/messages/${conversationId}`,
      tag: `dm:${conversationId}`,
    })
  }
  return { ok: true, data: row.id }
}

/** DM: знайти або створити розмову з людиною (RPC start_direct_conversation враховує блоки й dm_policy). */export async function startDirectConversation(otherUserId: string): Promise<ActionResult<string>> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data, error } = await supabase.rpc("start_direct_conversation", { other_user: otherUserId })
  if (error?.code === "42501") return { ok: false, error: "Не можна написати: блокування або налаштування приватності" }
  if (error || !data) return { ok: false, error: error?.message ?? "Не вдалося почати розмову" }
  return { ok: true, data: data as string }
}

/** Хто прийшов у Lumyn через мої інвайт-коди (реферальна статистика). */
export async function getInviteReferrals(): Promise<
  ActionResult<{ username: string; name: string; avatarUrl: string | null; joinedAt: string }[]>
> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: [] }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  const { data: rows } = await supabase
    .from("invites")
    .select("used_by, used_at")
    .eq("inviter_id", me)
    .not("used_by", "is", null)
    .order("used_at", { ascending: false })
    .limit(50)
  const list = (rows ?? []) as { used_by: string; used_at: string }[]
  if (!list.length) return { ok: true, data: [] }
  const { data: profs } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", list.map((r) => r.used_by))
  const byId = new Map(
    ((profs ?? []) as { id: string; username: string; display_name: string; avatar_url: string | null }[]).map((p) => [
      p.id,
      p,
    ]),
  )
  return {
    ok: true,
    data: list.flatMap((r) => {
      const p = byId.get(r.used_by)
      return p ? [{ username: p.username, name: p.display_name || p.username, avatarUrl: p.avatar_url, joinedAt: r.used_at }] : []
    }),
  }
}

/** Реакція на повідомлення (0014): on — поставити емодзі, off — прибрати свою. */
export async function reactMessage(messageId: string, emoji: string, on: boolean): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  const em = emoji.slice(0, 8)
  const { error } = on
    ? await supabase.from("message_reactions").upsert({ message_id: messageId, user_id: me, emoji: em } as never, { onConflict: "message_id,user_id,emoji", ignoreDuplicates: true })
    : await supabase.from("message_reactions").delete().match({ message_id: messageId, user_id: me, emoji: em })
  if (error?.code === "42P01") return { ok: false, error: "Реакції ще не налаштовано: запустіть apply-pending-8.sql" }
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Редагування свого повідомлення (0021): RLS дозволяє лише автору. */
export async function editMessage(messageId: string, content: string): Promise<ActionResult> {
  const text = content.trim()
  if (!text) return { ok: false, error: "Порожнє повідомлення" }
  if (text.length > 4000) return { ok: false, error: "Максимум 4000 символів" }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  const { data: row, error } = await supabase
    .from("messages")
    .update({ content: text, edited_at: new Date().toISOString() } as never)
    .eq("id", messageId)
    .eq("sender_id", me)
    .select("id")
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: "Редагувати можна лише своє повідомлення" }
  return { ok: true }
}

/** Видалення (0021): автор або адмін групи (творець розмови) через RPC. */
export async function deleteMessage(messageId: string): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  const rpc = await supabase.rpc("delete_message", { p_message: messageId })
  if (!rpc.error) return { ok: true }
  // міграцію ще не застосовано — принаймні автор може видалити своє (RLS)
  if (rpc.error.code === "42883" || rpc.error.code === "PGRST202") {
    const { error } = await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", me)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }
  if (rpc.error.code === "42501") return { ok: false, error: "Немає прав видаляти це повідомлення" }
  return { ok: false, error: rpc.error.message }
}

/** Позначити розмову прочитаною (мій рядок conversation_members). */
export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  // 0004: RPC ще й гасить «message»-сповіщення цієї розмови
  const rpc = await supabase.rpc("mark_conversation_read", { p_conversation: conversationId })
  if (!rpc.error) return { ok: true }
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .match({ conversation_id: conversationId, user_id: me })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Позначити сповіщення прочитаними (усі мої або вибрані). */
export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true }
  const { data } = await supabase.auth.getClaims()
  const me = data?.claims?.sub as string | undefined
  if (!me) return { ok: false, error: "Увійдіть" }
  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", me).is("read_at", null)
  if (ids?.length) q = q.in("id", ids)
  const { error } = await q
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Пошук людей для «Нове повідомлення» (RLS ховає заблокованих). */
export async function searchPeople(query: string): Promise<ActionResult<{ id: string; username: string; name: string; avatarUrl: string | null }[]>> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { ok: true, mock: true, data: [] }
  const { data: claims } = await supabase.auth.getClaims()
  const me = claims?.claims?.sub as string | undefined
  const q = query.replace(/[%_,()*\\]/g, " ").trim().slice(0, 40)
  let req = supabase.from("profiles").select("id, username, display_name, avatar_url").not("onboarded_at", "is", null).limit(8)
  if (q) req = req.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
  if (me) req = req.neq("id", me)
  const { data, error } = await req
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    data: (data ?? []).map((r) => ({ id: r.id, username: r.username, name: r.display_name || r.username, avatarUrl: r.avatar_url })),
  }
}

/** Embed-картка профілю в чаті (як у Discord, коли кидаєш посилання). */
export type ProfileEmbed = {
  username: string
  name: string
  avatarUrl: string | null
  accentColor: string
  verified: boolean
  bio: string
  followers: number
  following: number
  postsCount: number
  frame: string | null
  frameExpiresAt: string | null
  /** останній допис — короткий текст + перше фото, якщо є */
  latestPost: { id: string; content: string; imageUrl: string | null; createdAt: string } | null
}

export async function getProfileEmbed(rawUrl: string): Promise<ProfileEmbed | null> {
  const handle = profileHandleFromUrl(rawUrl)
  if (!handle) return null
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  // RLS: приватний профіль і його дописи побачить лише той, кому можна
  const { data } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("username", handle).maybeSingle()
  if (!data) return null
  const row = data as PublicProfileRow
  const user = profileRowToUser(row)

  const { data: postRow } = await supabase
    .from("feed_posts")
    .select("*")
    .eq("author_id", row.id)
    .is("reply_to", null)
    .is("repost_of", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let latestPost: ProfileEmbed["latestPost"] = null
  if (postRow) {
    const post = mapFeedRow(postRow as FeedPostRow)
    const image = post.media.find((m) => m.type === "image")
    latestPost = {
      id: post.id,
      content: post.content.slice(0, 280),
      imageUrl: image && image.type === "image" ? image.url : null,
      createdAt: post.createdAt,
    }
  }

  return {
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    accentColor: user.accentColor ?? "#7c5cff",
    verified: Boolean(user.verified),
    bio: user.bio,
    followers: user.followers,
    following: user.following,
    postsCount: user.postsCount,
    frame: user.frame ?? null,
    frameExpiresAt: user.frameExpiresAt ?? null,
    latestPost,
  }
}

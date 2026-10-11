import "server-only"

import type { Community, CommunityRole, Conversation, Notification, Post, Trend, User } from "@/types"
import type { CommunityMemberRow, CommunityRow, ConversationMemberRow, FeedPostRow, MessageRow, NotificationRow } from "@/types/database"
import { hashString } from "@/lib/format"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { mapFeedRow } from "@/lib/feed-map"
import { PUBLIC_PROFILE_COLUMNS, profileRowToUser, type PublicProfileRow } from "@/lib/profiles"

const WALL_LIMIT = 30
const FRIENDS_LIMIT = 50

/** Профіль за ніком (null — немає або приховано RLS, напр. блокування). */
export async function getProfileByUsername(username: string): Promise<User | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const handle = username.trim().toLowerCase()
  if (!/^[a-z0-9_]{1,24}$/.test(handle)) return null
  const { data } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("username", handle).maybeSingle()
  return data ? profileRowToUser(data as PublicProfileRow) : null
}

export type ProfilePageData = {
  user: User
  isMe: boolean
  /** читаю (accepted) */
  following: boolean
  /** запит на підписку очікує схвалення */
  requested: boolean
  posts: Post[]
  friends: User[]
  top4: User[]
}

export async function getProfilePage(username: string): Promise<ProfilePageData | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const user = await getProfileByUsername(username)
  if (!user) return null

  const { data: claims } = await supabase.auth.getClaims()
  const me = (claims?.claims?.sub as string | undefined) ?? null
  const isMe = me === user.id
  const top4Ids = (user.widgets?.top4 ?? []).slice(0, 4)

  const [followRes, postsRes, friendIdsRes, top4Res] = await Promise.all([
    me && !isMe
      ? supabase.from("follows").select("status").match({ follower_id: me, following_id: user.id }).maybeSingle()
      : Promise.resolve({ data: null }),
    // RLS сам ховає приватне/«близьких»/протерміновані Glow, якщо мені не можна
    supabase
      .from("feed_posts")
      .select("*")
      .eq("author_id", user.id)
      .is("reply_to", null)
      .order("created_at", { ascending: false })
      .limit(WALL_LIMIT),
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(FRIENDS_LIMIT),
    top4Ids.length ? supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", top4Ids) : Promise.resolve({ data: [] }),
  ])

  const friendIds = (friendIdsRes.data ?? []).map((r) => r.following_id)
  const { data: friendRows } = friendIds.length
    ? await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", friendIds)
    : { data: [] }
  const friendsById = new Map(((friendRows ?? []) as PublicProfileRow[]).map((r) => [r.id, profileRowToUser(r)]))
  const top4ById = new Map(((top4Res.data ?? []) as PublicProfileRow[]).map((r) => [r.id, profileRowToUser(r)]))

  const status = (followRes.data as { status?: string } | null)?.status
  return {
    user,
    isMe,
    following: status === "accepted",
    requested: status === "pending",
    posts: ((postsRes.data ?? []) as FeedPostRow[]).map((r) => mapFeedRow(r)),
    friends: friendIds.map((id) => friendsById.get(id)).filter((u): u is User => Boolean(u)),
    top4: top4Ids.map((id) => top4ById.get(id)).filter((u): u is User => Boolean(u)),
  }
}

/** Допис і відповіді на нього (RLS вирішує, чи можна бачити). */
export async function getPostWithReplies(id: string): Promise<{ post: Post; replies: Post[] } | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [postRes, repliesRes] = await Promise.all([
    supabase.from("feed_posts").select("*").eq("id", id).maybeSingle(),
    supabase.from("feed_posts").select("*").eq("reply_to", id).order("created_at", { ascending: true }).limit(100),
  ])
  if (!postRes.data) return null
  return {
    post: mapFeedRow(postRes.data as FeedPostRow),
    replies: ((repliesRes.data ?? []) as FeedPostRow[]).map((r) => mapFeedRow(r)),
  }
}

// ════════════════════════════════════════════════════════════════════
//  Живі дані замість демо (спільноти, люди, медіа, розмови, сповіщення)
// ════════════════════════════════════════════════════════════════════

type ServerClient = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>

async function myId(supabase: ServerClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims()
  return (data?.claims?.sub as string | undefined) ?? null
}

/** Рядок communities → модель Community (відтінок іконки — з хешу slug). */
function communityRowToCommunity(row: CommunityRow, role: CommunityRole | null = null): Community {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    coverUrl: row.cover_url,
    avatarUrl: row.avatar_url,
    members: row.member_count ?? 0,
    postsPerDay: 0,
    isPrivate: row.is_private,
    role,
    tags: [],
    hue: hashString(row.slug) % 360,
  }
}

const COMMUNITY_COLUMNS = "id, slug, name, description, avatar_url, cover_url, is_private, owner_id, member_count, created_at, updated_at"

/** Усі видимі мені спільноти (RLS) з моєю роллю. */
export async function listCommunities(limit = 50): Promise<{ mine: Community[]; recommended: Community[] }> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { mine: [], recommended: [] }
  const me = await myId(supabase)
  const [commRes, memRes] = await Promise.all([
    supabase.from("communities").select(COMMUNITY_COLUMNS).order("member_count", { ascending: false }).limit(limit),
    me ? supabase.from("community_members").select("community_id, role").eq("user_id", me) : Promise.resolve({ data: [] }),
  ])
  const roles = new Map(((memRes.data ?? []) as Pick<CommunityMemberRow, "community_id" | "role">[]).map((m) => [m.community_id, m.role]))
  const all = ((commRes.data ?? []) as CommunityRow[]).map((r) => communityRowToCommunity(r, roles.get(r.id) ?? null))
  return { mine: all.filter((c) => c.role), recommended: all.filter((c) => !c.role) }
}

/** Спільноти, де користувач є учасником (для вкладки профілю). */
export async function getUserCommunities(userId: string): Promise<Community[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []
  const { data: mem } = await supabase.from("community_members").select("community_id, role").eq("user_id", userId).limit(50)
  const rows = (mem ?? []) as Pick<CommunityMemberRow, "community_id" | "role">[]
  if (!rows.length) return []
  const { data } = await supabase.from("communities").select(COMMUNITY_COLUMNS).in("id", rows.map((r) => r.community_id))
  const roles = new Map(rows.map((r) => [r.community_id, r.role]))
  return ((data ?? []) as CommunityRow[]).map((r) => communityRowToCommunity(r, roles.get(r.id) ?? null))
}

/** Спільнота за slug: дані, дописи й учасники (RLS ховає приватні). */
export type CommunityPageData = {
  community: Community
  posts: Post[]
  members: { user: User; role: CommunityRole }[]
  /** запити в приватну спільноту (бачать owner/admin/mod) */
  requests: { user: User; createdAt: string }[]
  meId: string | null
}

export async function getCommunityPage(slug: string): Promise<CommunityPageData | null> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null
  const { data: row } = await supabase.from("communities").select(COMMUNITY_COLUMNS).eq("slug", slug).maybeSingle()
  if (!row) return null
  const c = row as CommunityRow
  const me = await myId(supabase)
  const [postsRes, memRes] = await Promise.all([
    supabase
      .from("feed_posts")
      .select("*")
      .eq("community_id", c.id)
      .is("reply_to", null)
      .order("created_at", { ascending: false })
      .limit(WALL_LIMIT),
    supabase.from("community_members").select("user_id, role").eq("community_id", c.id).order("joined_at", { ascending: true }).limit(100),
  ])
  const memRows = (memRes.data ?? []) as Pick<CommunityMemberRow, "user_id" | "role">[]
  const { data: profRows } = memRows.length
    ? await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", memRows.map((m) => m.user_id))
    : { data: [] }
  const byId = new Map(((profRows ?? []) as PublicProfileRow[]).map((r) => [r.id, profileRowToUser(r)]))
  const myRole = memRows.find((m) => m.user_id === me)?.role ?? null

  // запити: мій (чи надіслано) або всі (для owner/admin/mod — RLS)
  const { data: reqRows } = c.is_private && me
    ? await supabase.from("community_join_requests").select("user_id, created_at").eq("community_id", c.id).order("created_at", { ascending: true }).limit(100)
    : { data: [] }
  const reqs = (reqRows ?? []) as { user_id: string; created_at: string }[]
  const reqUserIds = reqs.map((r) => r.user_id).filter((id) => id !== me && !byId.has(id))
  const { data: reqProfiles } = reqUserIds.length
    ? await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", reqUserIds)
    : { data: [] }
  for (const r of (reqProfiles ?? []) as PublicProfileRow[]) byId.set(r.id, profileRowToUser(r))
  const canModerate = myRole === "owner" || myRole === "admin" || myRole === "mod"

  return {
    meId: me,
    requests: canModerate
      ? reqs.flatMap((r) => {
          const user = byId.get(r.user_id)
          return user ? [{ user, createdAt: r.created_at }] : []
        })
      : [],
    community: { ...communityRowToCommunity(c, myRole), requested: !myRole && reqs.some((r) => r.user_id === me) },
    posts: ((postsRes.data ?? []) as FeedPostRow[]).map((r) => ({ ...mapFeedRow(r), community: { slug: c.slug, name: c.name } })),
    members: memRows.flatMap((m) => {
      const user = byId.get(m.user_id)
      return user ? [{ user, role: m.role }] : []
    }),
  }
}

/** Справжні профілі для «Люди» / «Кого читати»: без мене й тих, кого я вже читаю. */
export async function listSuggestedPeople(limit = 6): Promise<User[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []
  const me = await myId(supabase)
  const { data: follows } = me
    ? await supabase.from("follows").select("following_id").eq("follower_id", me).limit(500)
    : { data: [] }
  const skip = new Set<string>([...(me ? [me] : []), ...((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)])
  const { data } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
    .not("onboarded_at", "is", null)
    .order("followers_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit + skip.size)
  return ((data ?? []) as PublicProfileRow[])
    .filter((r) => !skip.has(r.id))
    .slice(0, limit)
    .map(profileRowToUser)
}

/** Фото зі свіжих дописів (RLS вирішує, що мені видно). */
export async function listRecentPhotos(limit = 12): Promise<{ src: string; postId: string }[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []
  const { data } = await supabase
    .from("feed_posts")
    .select("*")
    .contains("media", [{ type: "image" }])
    .order("created_at", { ascending: false })
    .limit(limit)
  return ((data ?? []) as FeedPostRow[])
    .flatMap((r) => mapFeedRow(r).media.flatMap((m) => (m.type === "image" && m.url ? [{ src: m.url, postId: r.id }] : [])))
    .slice(0, limit)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MESSAGES_LIMIT = 200

/** Мої розмови: співрозмовник, останні повідомлення, кількість непрочитаних. */
export async function listConversations(): Promise<{ meId: string | null; conversations: Conversation[] }> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return { meId: null, conversations: [] }
  const me = await myId(supabase)
  if (!me) return { meId: null, conversations: [] }
  const { data: mine } = await supabase.from("conversation_members").select("conversation_id, last_read_at").eq("user_id", me).limit(100)
  const myRows = (mine ?? []) as Pick<ConversationMemberRow, "conversation_id" | "last_read_at">[]
  if (!myRows.length) return { meId: me, conversations: [] }
  const ids = myRows.map((r) => r.conversation_id)
  const [membersRes, messagesRes] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id, user_id").in("conversation_id", ids).neq("user_id", me),
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_LIMIT),
  ])
  const others = (membersRes.data ?? []) as Pick<ConversationMemberRow, "conversation_id" | "user_id">[]
  const { data: profRows } = others.length
    ? await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", [...new Set(others.map((o) => o.user_id))])
    : { data: [] }
  const users = new Map(((profRows ?? []) as PublicProfileRow[]).map((r) => [r.id, profileRowToUser(r)]))
  const msgs = (messagesRes.data ?? []) as Pick<MessageRow, "id" | "conversation_id" | "sender_id" | "content" | "created_at">[]

  const conversations = myRows.flatMap((r): Conversation[] => {
    const other = others.find((o) => o.conversation_id === r.conversation_id)
    const user = other && users.get(other.user_id)
    if (!user) return []
    const messages = msgs
      .filter((m) => m.conversation_id === r.conversation_id)
      .reverse()
      .map((m) => ({ id: m.id, senderId: m.sender_id, content: m.content, createdAt: m.created_at }))
    const unread = messages.filter((m) => m.senderId !== me && Date.parse(m.createdAt) > Date.parse(r.last_read_at)).length
    return [{ id: r.conversation_id, user, messages, unread }]
  })
  const lastAt = (c: Conversation) => c.messages[c.messages.length - 1]?.createdAt ?? ""
  conversations.sort((a, b) => lastAt(b).localeCompare(lastAt(a)))
  return { meId: me, conversations }
}

/**
 * Розмова за id (uuid) або за ніком співрозмовника.
 * Якщо з людиною ще не листувались — повертає «чернетку» з id = нік:
 * сама розмова створиться в БД лише з першим повідомленням.
 */
export async function getConversationThread(key: string, list: Conversation[]): Promise<Conversation | null> {
  const existing = list.find((c) => c.id === key || c.user.username === key.toLowerCase())
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  if (existing) {
    // повна історія (у списку лише останні повідомлення)
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", existing.id)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_LIMIT)
    const messages = ((data ?? []) as Pick<MessageRow, "id" | "sender_id" | "content" | "created_at">[])
      .reverse()
      .map((m) => ({ id: m.id, senderId: m.sender_id, content: m.content, createdAt: m.created_at }))
    return { ...existing, messages }
  }
  if (UUID_RE.test(key)) return null
  const user = await getProfileByUsername(key)
  if (!user) return null
  const me = await myId(supabase)
  if (!me || me === user.id) return null
  return { id: user.username, user, messages: [], unread: 0 }
}

/** Мої сповіщення (створюються лише тригерами БД). */
export async function listNotifications(limit = 100): Promise<Notification[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []
  const me = await myId(supabase)
  if (!me) return []
  const { data } = await supabase
    .from("notifications")
    .select("id, actor_id, type, post_id, read_at, created_at")
    .eq("recipient_id", me)
    .order("created_at", { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as Pick<NotificationRow, "id" | "actor_id" | "type" | "post_id" | "read_at" | "created_at">[]
  if (!rows.length) return []
  const actorIds = [...new Set(rows.map((r) => r.actor_id))]
  const postIds = [...new Set(rows.flatMap((r) => (r.post_id ? [r.post_id] : [])))]
  const [actorsRes, postsRes] = await Promise.all([
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", actorIds),
    postIds.length ? supabase.from("posts").select("id, content").in("id", postIds) : Promise.resolve({ data: [] }),
  ])
  const actors = new Map(((actorsRes.data ?? []) as PublicProfileRow[]).map((r) => [r.id, profileRowToUser(r)]))
  const previews = new Map(((postsRes.data ?? []) as { id: string; content: string }[]).map((p) => [p.id, p.content]))
  return rows.flatMap((r): Notification[] => {
    const actor = actors.get(r.actor_id)
    if (!actor) return []
    const preview = r.post_id ? previews.get(r.post_id)?.slice(0, 120) : undefined
    return [{ id: r.id, type: r.type, actor, postId: r.post_id, preview, createdAt: r.created_at, read: Boolean(r.read_at) }]
  })
}

/** Тренди: хештеги з видимих мені дописів за 7 днів (RPC trending_hashtags, міграція 0004). */
export async function listTrends(limit = 10): Promise<Trend[]> {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return []
  const { data, error } = await supabase.rpc("trending_hashtags", { p_days: 7, p_limit: limit })
  if (error || !data) return []
  return (data as { tag: string; posts: number }[]).map((r) => ({ tag: r.tag, category: "За 7 днів", posts: Number(r.posts) }))
}

export type SearchResults = { people: User[]; communities: Community[]; posts: Post[] }

/** Пошук по людях, спільнотах і дописах (RLS вирішує, що мені видно). */
export async function searchAll(query: string, limits = { people: 6, communities: 6, posts: 20 }): Promise<SearchResults> {
  const empty = { people: [], communities: [], posts: [] }
  const supabase = await getSupabaseServerClient()
  if (!supabase) return empty
  // символи, що ламають синтаксис фільтрів PostgREST / шаблонів LIKE
  const q = query.replace(/[%_,()*\\:"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)
  if (!q) return empty
  const tag = q.replace(/^#/, "")
  const [peopleRes, commRes, postsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_COLUMNS)
      .not("onboarded_at", "is", null)
      .or(`username.ilike.%${tag}%,display_name.ilike.%${tag}%`)
      .limit(limits.people),
    supabase
      .from("communities")
      .select(COMMUNITY_COLUMNS)
      .or(`name.ilike.%${tag}%,slug.ilike.%${tag}%,description.ilike.%${tag}%`)
      .order("member_count", { ascending: false })
      .limit(limits.communities),
    supabase
      .from("feed_posts")
      .select("*")
      .is("reply_to", null)
      .is("repost_of", null)
      .ilike("content", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(limits.posts),
  ])
  return {
    people: ((peopleRes.data ?? []) as PublicProfileRow[]).map(profileRowToUser),
    communities: ((commRes.data ?? []) as CommunityRow[]).map((r) => communityRowToCommunity(r)),
    posts: ((postsRes.data ?? []) as FeedPostRow[]).map((r) => mapFeedRow(r)),
  }
}

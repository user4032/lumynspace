import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { Post, PostMedia, PostReason } from "@/types"
import type { FeedPostRow } from "@/types/database"
import { hiResAvatarUrl } from "@/lib/avatar"

/** Перетворює рядок view feed_posts у модель UI. */
export function mapFeedRow(row: FeedPostRow, reason: PostReason | null = null): Post {
  const media = (Array.isArray(row.media) ? row.media : []) as PostMedia[]
  const poll = media.find((m) => m.type === "poll")
  return {
    id: row.id,
    author: {
      id: row.author_id,
      username: row.author_username,
      name: row.author_display_name || row.author_username,
      avatarUrl: hiResAvatarUrl(row.author_avatar_url),
      accentColor: row.author_accent_color,
      verified: row.author_verified ?? false,
      frame: row.author_frame ?? null,
      frameExpiresAt: row.author_frame_expires_at ?? null,
      bio: "",
      status: "",
      joinedAt: row.created_at,
      followers: 0,
      following: 0,
      postsCount: 0,
    },
    community:
      row.community_slug && row.community_name
        ? { slug: row.community_slug, name: row.community_name }
        : null,
    content: row.content,
    media: media.filter((m) => m.type !== "poll"),
    poll: poll && poll.type === "poll" ? { options: poll.options, votes: poll.options.map(() => 0) } : null,
    createdAt: row.created_at,
    lights: row.light_count,
    lit: row.viewer_has_lit,
    replies: row.reply_count,
    reposts: row.repost_count,
    views: row.view_count ?? 0,
    reposted: row.viewer_has_reposted,
    replyTo: row.reply_to,
    mode: row.mode,
    expiresAt: row.expires_at,
    audience: row.audience,
    reason,
    edited: Boolean(row.edited_at),
  }
}

/**
 * Дозаповнює рядки назвою/slug спільноти, якщо view feed_posts їх ще не має
 * (наприклад, до застосування міграції 0025). Після міграції — нуль запитів.
 */
export async function withCommunityMeta(supabase: SupabaseClient<Database>, rows: FeedPostRow[]): Promise<FeedPostRow[]> {
  const ids = [
    ...new Set(
      rows
        .filter((r) => r.community_id && (!r.community_slug || !r.community_name))
        .map((r) => r.community_id as string)
    ),
  ]
  if (!ids.length) return rows
  const { data } = await supabase.from("communities").select("id, slug, name").in("id", ids)
  const byId = new Map(((data ?? []) as { id: string; slug: string; name: string }[]).map((c) => [c.id, c]))
  return rows.map((row) => {
    if (!row.community_id || (row.community_slug && row.community_name)) return row
    const community = byId.get(row.community_id)
    return community ? { ...row, community_slug: community.slug, community_name: community.name } : row
  })
}

/**
 * Рядки стрічки → моделі UI з розв'язком репостів:
 *  • чистий репост (без тексту) → оригінальний допис + «X поширив»
 *  • цитування (репост + текст)  → допис із вбудованим quote
 *  • оригінал видалено/не видно  → репост-обгортку не показуємо
 */
export async function resolveFeedRows(supabase: SupabaseClient<Database>, inputRows: FeedPostRow[]): Promise<Post[]> {
  const rows = await withCommunityMeta(supabase, inputRows)
  const wrappers = rows
    .map((row, i) => ({ row, i, origId: row.repost_of }))
    .filter((w): w is { row: FeedPostRow; i: number; origId: string } => Boolean(w.origId))

  if (!wrappers.length) return rows.map((r) => mapFeedRow(r))

  const ids = [...new Set(wrappers.map((w) => w.origId))]
  const { data: originals } = await supabase.from("feed_posts").select("*").in("id", ids)
  const originalRows = await withCommunityMeta(supabase, (originals ?? []) as FeedPostRow[])
  const originalById = new Map(originalRows.map((r) => [r.id, r]))

  const result: Post[] = new Array(rows.length)
  const drop = new Set<number>()
  rows.forEach((row, i) => {
    const w = wrappers.find((x) => x.i === i)
    if (!w) {
      result[i] = mapFeedRow(row)
      return
    }
    const original = originalById.get(w.origId)
    if (!original) {
      drop.add(i)
      return
    }
    const reposter = mapFeedRow(row).author
    if (!row.content.trim()) {
      // чистий репост: показуємо оригінал із шапкою «X поширив»
      const post = mapFeedRow(original)
      post.repostedBy = reposter
      result[i] = post
    } else {
      // цитування
      const post = mapFeedRow(row)
      post.quote = mapFeedRow(original)
      result[i] = post
    }
  })
  return result.filter((_, i) => !drop.has(i))
}

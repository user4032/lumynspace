import type { FeedPage, FeedQuery, FeedTab, Post, PostReason } from "@/types"
import type { FeedPostRow, ForYouRow } from "@/types/database"
import { getMockFeedPage, PAGE_SIZE } from "./mock-data"
import { getSupabaseBrowserClient } from "./supabase/client"
import { mapFeedRow } from "./feed-map"

export { mapFeedRow }

/**
 * Одна сторінка стрічки.
 *  • «Для тебе» — RPC for_you_feed (ваги з profiles.feed_prefs, причина показу) + feed_posts.
 *  • «Підписки» — RPC following_feed (хронологічно).
 *  • Без Supabase — та сама формула на мок-даних (lib/mock-data.ts → scorePost).
 */
export async function fetchFeedPage(tab: FeedTab, q: FeedQuery): Promise<FeedPage> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) {
    await new Promise((r) => setTimeout(r, q.cursor === 0 ? 450 : 700))
    return getMockFeedPage(tab, q)
  }

  if (tab === "following") {
    const { data, error } = await supabase.rpc("following_feed", { p_limit: PAGE_SIZE, p_before: q.before ?? null })
    if (error) throw error
    const rows = (data ?? []) as FeedPostRow[]
    return { posts: rows.map((r) => mapFeedRow(r)), nextCursor: rows.length === PAGE_SIZE ? q.cursor + 1 : null }
  }

  // Ранжування на сервері; offset = вже показані (після зміни тюнера список переранжовується)
  const offset = q.exclude?.length ?? 0
  const { data: ranked, error } = await supabase.rpc("for_you_feed", { p_limit: PAGE_SIZE, p_offset: offset })
  if (error) throw error
  const order = (ranked ?? []) as ForYouRow[]
  if (!order.length) return { posts: [], nextCursor: null }

  const { data: rows, error: e2 } = await supabase
    .from("feed_posts")
    .select("*")
    .in("id", order.map((r) => r.post_id))
  if (e2) throw e2
  const byId = new Map(((rows ?? []) as FeedPostRow[]).map((r) => [r.id, r]))

  // імена для «чому я це бачу»
  const actorIds = [...new Set(order.map((r) => r.reason_actor_id).filter(Boolean))] as string[]
  const communityIds = [...new Set(order.map((r) => r.reason_community_id).filter(Boolean))] as string[]
  const [actors, comms] = await Promise.all([
    actorIds.length ? supabase.from("profiles").select("id, username, display_name").in("id", actorIds) : { data: [] },
    communityIds.length ? supabase.from("communities").select("id, slug, name").in("id", communityIds) : { data: [] },
  ])
  const actorById = new Map((actors.data ?? []).map((a) => [a.id, a]))
  const commById = new Map((comms.data ?? []).map((c) => [c.id, c]))

  const posts = order
    .map((r) => {
      const row = byId.get(r.post_id)
      if (!row) return null
      const actor = r.reason_actor_id ? actorById.get(r.reason_actor_id) : null
      const community = r.reason_community_id ? commById.get(r.reason_community_id) : null
      const reason: PostReason | null = r.reason
        ? {
            type: r.reason,
            actor: actor ? { id: actor.id, username: actor.username, name: actor.display_name || actor.username } : null,
            community: community ? { slug: community.slug, name: community.name } : null,
          }
        : null
      return mapFeedRow(row, reason)
    })
    .filter((p): p is Post => p !== null)
    .filter((p) => !q.hiddenAuthors?.includes(p.author.id))

  return { posts, nextCursor: order.length === PAGE_SIZE ? q.cursor + 1 : null }
}

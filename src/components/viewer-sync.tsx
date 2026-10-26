"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { isMockMode } from "@/lib/env"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { PUBLIC_PROFILE_COLUMNS, profileRowToUser, readFeedPrefs, readWidgets, type PublicProfileRow } from "@/lib/profiles"
import { viewerActions } from "@/lib/viewer-store"
import type { DmPolicy, User } from "@/types"

const PEOPLE_LIMIT = 200

/**
 * Supabase: підтягує мій профіль і списки (близькі, блок, мют, кого читаю) у viewer-store,
 * а якщо онбординг ще не пройдено — веде на /onboarding. У демо нічого не робить.
 */
export function ViewerSync() {
  const router = useRouter()

  useEffect(() => {
    if (isMockMode) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    let cancelled = false

    void (async () => {
      const { data: auth } = await supabase.auth.getUser()
      const me = auth.user?.id
      if (!me || cancelled) return

      // 0023: протухлі рамки зникають з колекції, у сповіщення падає frame_expired
      await supabase.rpc("sync_expired_frames")

      const [profileRes, closeRes, blocksRes, mutesRes, followsRes, bookmarksRes] = await Promise.all([
        supabase.from("profiles").select(`${PUBLIC_PROFILE_COLUMNS}, feed_prefs, birth_year, onboarded_at, hide_following`).eq("id", me).maybeSingle(),
        supabase.from("close_friends").select("friend_id").eq("owner_id", me),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", me),
        supabase.from("mutes").select("muted_id").eq("muter_id", me),
        supabase.from("follows").select("following_id").eq("follower_id", me).eq("status", "accepted").limit(PEOPLE_LIMIT),
        // 0011: якщо міграцію ще не запускали — просто порожній список
        supabase.from("bookmarks").select("post_id").eq("user_id", me).order("created_at", { ascending: false }).limit(500),
      ])
      // status_icon окремо: якщо міграцію 0009 ще не запущено, решта профілю не ламається
      const iconRes = await supabase.from("profiles").select("status_icon" as "id").eq("id", me).maybeSingle()
      if (cancelled) return
      const row = profileRes.data as (PublicProfileRow & { feed_prefs: unknown; birth_year: number | null; onboarded_at: string | null; hide_following?: boolean }) | null
      if (!row) return

      const closeFriends = (closeRes.data ?? []).map((r) => r.friend_id)
      const blocked = (blocksRes.data ?? []).map((r) => r.blocked_id)
      const muted = (mutesRes.data ?? []).map((r) => r.muted_id)
      const followingIds = (followsRes.data ?? []).map((r) => r.following_id)
      const bookmarks = (bookmarksRes.data ?? []).map((r) => r.post_id)
      const widgets = readWidgets(row.widgets)

      const ids = [...new Set([...followingIds, ...closeFriends, ...blocked, ...muted, ...(widgets.top4 ?? [])])].filter((id) => id !== me)
      let people: User[] = []
      if (ids.length) {
        const { data } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", ids.slice(0, PEOPLE_LIMIT))
        people = ((data ?? []) as PublicProfileRow[]).map(profileRowToUser)
      }
      if (cancelled) return

      const self = profileRowToUser(row)
      viewerActions.hydrate({
        onboarded: Boolean(row.onboarded_at),
        profile: {
          username: self.username,
          name: self.name,
          bio: self.bio,
          status: self.status,
          statusExpiresAt: self.statusExpiresAt ?? null,
          statusIcon: iconRes.error ? null : ((iconRes.data as { status_icon?: string | null } | null)?.status_icon ?? null),
          accentColor: row.accent_color,
          bannerStyle: row.banner_style,
          top4: widgets.top4 ?? [],
          nowPlaying: widgets.now_playing ?? null,
          lastfmUsername: String((row.widgets as { lastfm_username?: unknown } | null)?.lastfm_username ?? ""),
        },
        feedPrefs: readFeedPrefs(row.feed_prefs),
        closeFriends,
        blocked,
        muted,
        bookmarks,
        privacy: { isPrivate: row.is_private, dmPolicy: row.dm_policy as DmPolicy, birthYear: row.birth_year, showOnline: true, hideFollowing: row.hide_following ?? false },
        self,
        people,
      })

      if (!row.onboarded_at && !window.location.pathname.startsWith("/onboarding")) router.replace("/onboarding")

      // Realtime синхронізація «кого читаю»
      const channel = supabase
        .channel(`follows-sync:${me}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${me}` },
          async () => {
            const { data: followsData } = await supabase
              .from("follows")
              .select("following_id")
              .eq("follower_id", me)
              .eq("status", "accepted")
              .limit(PEOPLE_LIMIT)
            const followingIds = (followsData ?? []).map((r) => r.following_id)
            if (followingIds.length) {
              const { data: peopleData } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", followingIds)
              const people = ((peopleData ?? []) as PublicProfileRow[]).map(profileRowToUser)
              viewerActions.setPeople(people)
            } else {
              viewerActions.setPeople([])
            }
          }
        )
        .subscribe()

      return () => {
        cancelled = true
        void supabase.removeChannel(channel)
      }
    })()

    return () => {
      cancelled = true
    }
    // профіль тягнемо раз на монтування layout; навігація всередині (main) не перезавантажує
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

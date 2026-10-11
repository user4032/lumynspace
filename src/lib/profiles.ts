import type { FeedPrefs, ProfileWidgets, User } from "@/types"
import type { ProfileRow } from "@/types/database"

/** Колонки profiles, які потрібні UI (без birth_year / invited_by чужих людей). */
export const PUBLIC_PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, cover_url, bio, status, status_expires_at, location, website, followers_count, following_count, posts_count, accent_color, banner_style, widgets, is_private, dm_policy, created_at"

export type PublicProfileRow = Pick<
  ProfileRow,
  | "id"
  | "username"
  | "display_name"
  | "avatar_url"
  | "cover_url"
  | "bio"
  | "status"
  | "status_expires_at"
  | "location"
  | "website"
  | "followers_count"
  | "following_count"
  | "posts_count"
  | "accent_color"
  | "banner_style"
  | "widgets"
  | "is_private"
  | "dm_policy"
  | "created_at"
>

export function readWidgets(raw: unknown): ProfileWidgets {
  const w = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const top4 = Array.isArray(w.top4) ? w.top4.filter((x): x is string => typeof x === "string").slice(0, 4) : []
  const np = w.now_playing as { title?: unknown; artist?: unknown } | null | undefined
  const now_playing =
    np && typeof np.title === "string" && np.title ? { title: np.title, artist: typeof np.artist === "string" ? np.artist : "" } : null
  return { top4, now_playing }
}

export function readFeedPrefs(raw: unknown): FeedPrefs {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)
  return { social: n(p.social), media: n(p.media) }
}

/** Рядок profiles → модель User для компонентів. */
export function profileRowToUser(row: PublicProfileRow): User {
  return {
    id: row.id,
    username: row.username,
    name: row.display_name || row.username,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    bio: row.bio ?? "",
    status: row.status ?? "",
    statusExpiresAt: row.status_expires_at,
    location: row.location || undefined,
    website: row.website || undefined,
    joinedAt: row.created_at,
    followers: row.followers_count ?? 0,
    following: row.following_count ?? 0,
    postsCount: row.posts_count ?? 0,
    accentColor: row.accent_color,
    bannerStyle: row.banner_style,
    widgets: readWidgets(row.widgets),
    isPrivate: row.is_private,
    dmPolicy: row.dm_policy,
  }
}

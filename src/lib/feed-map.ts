import type { Post, PostMedia, PostReason } from "@/types"
import type { FeedPostRow } from "@/types/database"

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
      avatarUrl: row.author_avatar_url,
      accentColor: row.author_accent_color,
      bio: "",
      status: "",
      joinedAt: row.created_at,
      followers: 0,
      following: 0,
      postsCount: 0,
    },
    content: row.content,
    media: media.filter((m) => m.type !== "poll"),
    poll: poll && poll.type === "poll" ? { options: poll.options, votes: poll.options.map(() => 0) } : null,
    createdAt: row.created_at,
    lights: row.light_count,
    lit: row.viewer_has_lit,
    replies: row.reply_count,
    reposts: row.repost_count,
    reposted: row.viewer_has_reposted,
    replyTo: row.reply_to,
    mode: row.mode,
    expiresAt: row.expires_at,
    audience: row.audience,
    reason,
  }
}

/**
 * Типи бази даних Lumyn — написані вручну відповідно до
 * supabase/migrations/0001_init.sql + 0002_mvp.sql.
 * Коли з'явиться реальний проєкт, їх можна перегенерувати:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CommunityRole = "owner" | "admin" | "mod" | "member"
export type NotificationType =
  | "like" // застаріле (до 0002), нові — "light"
  | "light"
  | "reply"
  | "follow"
  | "follow_request"
  | "repost"
  | "mention"
  | "message"
  | "friend_joined"

export type PostMode = "permanent" | "glow"
export type PostAudience = "public" | "close_friends" | "circle"
export type DmPolicy = "everyone" | "followers" | "nobody"
export type FollowStatus = "pending" | "accepted"
export type FeedReason = "friend_light" | "community_popular" | "new_author" | "popular"
export type BannerStyle = "aurora" | "mesh" | "grid" | "image" | "solid"
export type ReportTarget = "post" | "profile" | "message" | "community"
export type ReportReason =
  | "spam"
  | "harassment"
  | "hate"
  | "violence"
  | "nudity"
  | "self_harm"
  | "impersonation"
  | "minor_safety"
  | "other"
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed"

/** Вкладення допису (поле posts.media) */
export type ImageMedia = {
  type: "image"
  url: string
  width?: number
  height?: number
  alt?: string
}
export type CodeMedia = { type: "code"; lang: string; code: string; filename?: string }
export type PollMedia = { type: "poll"; options: string[]; ends_at?: string }
export type PostMedia = ImageMedia | CodeMedia | PollMedia

/** profiles.widgets */
export type ProfileWidgets = {
  /** до 4 id друзів («Топ-4», як у MySpace) */
  top4?: string[]
  now_playing?: { title: string; artist: string } | null
}

/** profiles.feed_prefs — ваги тюнера стрічки, 0..1 */
export type FeedPrefs = {
  /** 0 — більше друзів, 1 — більше рекомендацій */
  social: number
  /** 0 — більше тексту, 1 — більше медіа */
  media: number
}

type Timestamps = { created_at: string }

export type ProfileRow = Timestamps & {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string
  status: string
  status_expires_at: string | null
  location: string
  website: string
  followers_count: number
  following_count: number
  posts_count: number
  accent_color: string
  banner_style: BannerStyle
  widgets: Json
  feed_prefs: Json
  birth_year: number | null
  is_private: boolean
  dm_policy: DmPolicy
  onboarded_at: string | null
  invited_by: string | null
  updated_at: string
}

export type CommunityRow = Timestamps & {
  id: string
  slug: string
  name: string
  description: string
  avatar_url: string | null
  cover_url: string | null
  is_private: boolean
  owner_id: string
  member_count: number
  updated_at: string
}

export type CommunityMemberRow = {
  community_id: string
  user_id: string
  role: CommunityRole
  joined_at: string
}

export type PostRow = Timestamps & {
  id: string
  author_id: string
  community_id: string | null
  content: string
  media: Json
  reply_to: string | null
  repost_of: string | null
  light_count: number
  reply_count: number
  repost_count: number
  mode: PostMode
  expires_at: string | null
  audience: PostAudience
  circle_id: string | null
  updated_at: string
}

export type LightRow = Timestamps & { user_id: string; post_id: string }
export type PollVoteRow = Timestamps & {
  post_id: string
  user_id: string
  option_index: number
}
export type FollowRow = Timestamps & { follower_id: string; following_id: string; status: FollowStatus }

export type ConversationRow = Timestamps & {
  id: string
  created_by: string
  is_group: boolean
  title: string | null
  updated_at: string
}

export type ConversationMemberRow = {
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string
}

export type MessageRow = Timestamps & {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  edited_at: string | null
}

export type NotificationRow = Timestamps & {
  id: string
  recipient_id: string
  actor_id: string
  type: NotificationType
  post_id: string | null
  conversation_id: string | null
  read_at: string | null
}

export type CommunityJoinRequestRow = { community_id: string; user_id: string; created_at: string }

export type CloseFriendRow = Timestamps & { owner_id: string; friend_id: string }
export type CircleRow = Timestamps & { id: string; owner_id: string; name: string; emoji: string }
export type CircleMemberRow = { circle_id: string; user_id: string; added_at: string }
export type InviteRow = Timestamps & {
  code: string
  inviter_id: string
  used_by: string | null
  used_at: string | null
}
export type ReservedHandleRow = Timestamps & { handle: string; email: string; claimed_by: string | null }
export type BlockRow = Timestamps & { blocker_id: string; blocked_id: string }
export type MuteRow = Timestamps & { muter_id: string; muted_id: string }
export type ReportRow = Timestamps & {
  id: string
  reporter_id: string
  target_type: ReportTarget
  target_id: string
  reason: ReportReason
  details: string
  status: ReportStatus
  resolved_at: string | null
}

export type FeedPostRow = PostRow & {
  author_username: string
  author_display_name: string
  author_avatar_url: string | null
  author_accent_color: string
  viewer_has_lit: boolean
  viewer_has_reposted: boolean
}

export type ForYouRow = {
  post_id: string
  score: number
  reason: FeedReason | null
  reason_actor_id: string | null
  reason_community_id: string | null
}

/** Рядок для insert: поля з default стають необов'язковими */
type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required>>

type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Insertable<Row, Required>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id" | "username">
      communities: Table<CommunityRow, "slug" | "name" | "owner_id">
      community_members: Table<CommunityMemberRow, "community_id" | "user_id">
      posts: Table<PostRow, "author_id">
      lights: Table<LightRow, "user_id" | "post_id">
      poll_votes: Table<PollVoteRow, "post_id" | "user_id" | "option_index">
      follows: Table<FollowRow, "follower_id" | "following_id">
      conversations: Table<ConversationRow, never>
      conversation_members: Table<ConversationMemberRow, "conversation_id" | "user_id">
      messages: Table<MessageRow, "conversation_id" | "sender_id" | "content">
      notifications: Table<NotificationRow, "recipient_id" | "actor_id" | "type">
      close_friends: Table<CloseFriendRow, "owner_id" | "friend_id">
      circles: Table<CircleRow, "name">
      circle_members: Table<CircleMemberRow, "circle_id" | "user_id">
      invites: Table<InviteRow, "code">
      reserved_handles: Table<ReservedHandleRow, "handle" | "email">
      blocks: Table<BlockRow, "blocker_id" | "blocked_id">
      mutes: Table<MuteRow, "muter_id" | "muted_id">
      reports: Table<ReportRow, "target_type" | "target_id" | "reason">
      /** 0004: запити в приватні спільноти */
      community_join_requests: Table<CommunityJoinRequestRow, "community_id">
    }
    Views: {
      feed_posts: { Row: FeedPostRow; Relationships: [] }
    }
    Functions: {
      start_direct_conversation: { Args: { other_user: string }; Returns: string }
      is_community_member: { Args: { cid: string }; Returns: boolean }
      is_conversation_member: { Args: { conv: string }; Returns: boolean }
      can_view_community: { Args: { cid: string }; Returns: boolean }
      can_view_post: { Args: { pid: string }; Returns: boolean }
      can_dm: { Args: { sender: string; recipient: string }; Returns: boolean }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      community_role_of: {
        Args: { cid: string; uid?: string }
        Returns: CommunityRole | null
      }
      create_invite: { Args: Record<string, never>; Returns: string }
      /** 0003: чи потрібен інвайт-код (false, поки в системі немає жодного інвайту) */
      invite_required: { Args: Record<string, never>; Returns: boolean }
      is_handle_available: { Args: { p_handle: string }; Returns: boolean }
      reserve_handle: { Args: { p_handle: string; p_email: string }; Returns: boolean }
      complete_onboarding: {
        Args: { p_username: string; p_birth_year: number; p_invite_code?: string | null; p_accent?: string | null }
        Returns: undefined
      }
      respond_follow_request: { Args: { p_follower: string; p_accept: boolean }; Returns: undefined }
      for_you_feed: { Args: { p_limit?: number; p_offset?: number }; Returns: ForYouRow[] }
      following_feed: { Args: { p_limit?: number; p_before?: string | null }; Returns: FeedPostRow[] }
      /** 0004 */
      trending_hashtags: { Args: { p_days?: number; p_limit?: number }; Returns: { tag: string; posts: number }[] }
      mark_conversation_read: { Args: { p_conversation: string }; Returns: undefined }
      respond_join_request: { Args: { p_community: string; p_user: string; p_accept: boolean }; Returns: undefined }
      delete_my_account: { Args: Record<string, never>; Returns: undefined }
    }
    Enums: {
      community_role: CommunityRole
      notification_type: NotificationType
      post_mode: PostMode
      post_audience: PostAudience
      dm_policy: DmPolicy
      follow_status: FollowStatus
      feed_reason: FeedReason
      report_target: ReportTarget
      report_reason: ReportReason
      report_status: ReportStatus
    }
    CompositeTypes: Record<string, never>
  }
}

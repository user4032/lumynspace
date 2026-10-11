import type {
  BannerStyle,
  CodeMedia,
  CommunityRole,
  DmPolicy,
  FeedPrefs,
  FeedReason,
  ImageMedia,
  NotificationType,
  PollMedia,
  PostAudience,
  PostMedia,
  PostMode,
  ProfileWidgets,
  ReportReason,
} from "./database"

export type {
  BannerStyle,
  CodeMedia,
  CommunityRole,
  DmPolicy,
  FeedPrefs,
  FeedReason,
  ImageMedia,
  NotificationType,
  PollMedia,
  PostAudience,
  PostMedia,
  PostMode,
  ProfileWidgets,
  ReportReason,
}

/** Моделі для UI (те, що отримують компоненти) */
export type User = {
  id: string
  username: string
  name: string
  avatarUrl?: string | null
  coverUrl?: string | null
  bio: string
  status: string
  location?: string
  website?: string
  joinedAt: string
  followers: number
  following: number
  postsCount: number
  verified?: boolean
  online?: boolean
  /** Акцентний колір профілю (#rrggbb) — фарбує банер, кнопки, підсвітку карток */
  accentColor?: string
  bannerStyle?: BannerStyle
  widgets?: ProfileWidgets
  /** Коли статус зникне (ISO). null — назавжди */
  statusExpiresAt?: string | null
  isPrivate?: boolean
  dmPolicy?: DmPolicy
}

export type Poll = {
  options: string[]
  votes: number[]
  votedIndex?: number | null
  endsAt?: string
}

export type Post = {
  id: string
  /** id оптимістичного допису до збереження — стабільний React key після заміни на справжній id */
  clientKey?: string
  author: User
  community?: { slug: string; name: string } | null
  content: string
  media: PostMedia[]
  poll?: Poll | null
  createdAt: string
  /** «Світло» (замість лайків) */
  lights: number
  lit: boolean
  replies: number
  reposts: number
  reposted: boolean
  repostedBy?: User | null
  replyTo?: string | null
  /** permanent — звичайний допис; glow — живе 24 год, світло продовжує життя */
  mode: PostMode
  /** Для glow — коли згасне (ISO) */
  expiresAt?: string | null
  audience: PostAudience
  /** Чому допис у «Для тебе» (лише для рекомендацій) */
  reason?: PostReason | null
}

export type PostReason = {
  type: FeedReason
  /** хто з друзів дав світло (friend_light) */
  actor?: Pick<User, "id" | "username" | "name"> | null
  /** спільнота (community_popular) */
  community?: { slug: string; name: string } | null
}

export type Community = {
  id: string
  slug: string
  name: string
  description: string
  coverUrl?: string | null
  /** Supabase Storage (community-media) */
  avatarUrl?: string | null
  members: number
  postsPerDay: number
  isPrivate: boolean
  role?: CommunityRole | null
  /** приватна спільнота: мій запит на вступ очікує розгляду */
  requested?: boolean
  tags: string[]
  hue: number
}

export type Message = {
  id: string
  senderId: string
  content: string
  createdAt: string
}

export type Conversation = {
  id: string
  user: User
  messages: Message[]
  unread: number
}

export type Notification = {
  id: string
  type: NotificationType
  actor: User
  postId?: string | null
  preview?: string
  createdAt: string
  read: boolean
}

export type Trend = { tag: string; category: string; posts: number }

export type FeedTab = "for-you" | "following"

export type FeedPage = { posts: Post[]; nextCursor: number | null }

export type FeedQuery = {
  cursor: number
  prefs: FeedPrefs
  /** id, які вже показано (щоб після переранжування не було дублікатів) */
  exclude?: string[]
  hiddenAuthors?: string[]
  /** created_at останнього показаного допису (курсор для «Підписок») */
  before?: string | null
}

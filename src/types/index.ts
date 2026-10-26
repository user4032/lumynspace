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
  /** ключ іконки статусу (STATUS_ICONS) */
  statusIcon?: string | null
  /** рамка профілю (0016) */
  frame?: string | null
  frameExpiresAt?: string | null
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
  /** цитований допис (мій допис із репостом + текстом) */
  quote?: Post | null
  /** допис відредаговано автором */
  edited?: boolean
  replyTo?: string | null
  /** permanent — звичайний допис; glow — живе 24 год, світло продовжує життя */
  mode: PostMode
  /** Для glow — коли згасне (ISO) */
  expiresAt?: string | null
  audience: PostAudience
  /** Чому допис у «Для тебе» (лише для рекомендацій) */
  reason?: PostReason | null
  views?: number
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
  /** показувати список учасників (0025); за замовчуванням true */
  membersVisible?: boolean
  role?: CommunityRole | null
  /** приватна спільнота: мій запит на вступ очікує розгляду */
  requested?: boolean
  tags: string[]
  hue: number
}

/** Знімок історії у відповіді: прев'ю живе у чаті навіть після 24 годин. */
export type ChatStorySnapshot = {
  id: string
  mediaUrl: string
  mime: string
  durationSec: number
  caption: string | null
  createdAt: string
  author: {
    id: string
    username: string
    name: string
    avatarUrl: string | null
  }
}

/** Вкладення повідомлення (приватний бакет chat-files або знімок історії) */
export type ChatAttachment = {
  kind: "image" | "file" | "audio" | "story"
  path: string
  name: string
  size: number
  mime: string
  width?: number
  height?: number
  /** голосове: тривалість у секундах */
  duration?: number
  /** kind === "story": дані для прев'ю у чаті */
  story?: ChatStorySnapshot
}

export type MessageReaction = { emoji: string; count: number; mine: boolean }

/** Сторіс (0015): фото/відео на 24 год + взаємодії (0024) */
export type Story = {
  id: string
  mediaUrl: string
  mime: string
  durationSec: number
  caption: string | null
  createdAt: string
  seen: boolean
  /** перегляди (точно для власних сторіс) */
  viewCount: number
  /** «світло» на сторіс */
  lightCount: number
  /** усього реакцій */
  reactionCount: number
  litByMe: boolean
  myReaction: string | null
}

/** Група сторіс одного автора для смуги над стрічкою */
export type StoryGroup = {
  author: Pick<User, "id" | "username" | "name" | "avatarUrl" | "verified" | "frame" | "frameExpiresAt">
  isMe: boolean
  stories: Story[]
}

/** Короткий профіль у статистиці сторіс */
export type StoryActor = Pick<User, "id" | "username" | "name" | "avatarUrl" | "verified">

/** Детальна статистика власного сторіс (автор бачить, хто дивився / світив / реагував) */
export type StoryInsights = {
  views: { user: StoryActor; at: string }[]
  lights: { user: StoryActor; at: string }[]
  reactions: { emoji: string; users: StoryActor[] }[]
}

export type Message = {
  id: string
  senderId: string
  content: string
  createdAt: string
  /** відповідь на конкретне повідомлення (0014) */
  replyTo?: string | null
  /** реакції (агреговані, 0014) */
  reactions?: MessageReaction[]
  attachments?: ChatAttachment[]
  /** 0021: повідомлення відредаговане */
  editedAt?: string | null
}

export type Conversation = {
  id: string
  user: User
  messages: Message[]
  unread: number
  /** групова розмова (is_group): назва й учасники замість одного співрозмовника */
  group?: { title: string; members: User[] }
  /** 0001: творець розмови = адмін групи (може видаляти будь-які повідомлення) */
  createdBy?: string | null
}

export type Notification = {
  id: string
  type: NotificationType
  actor: User
  postId?: string | null
  /** 0023: рамка, термін дії якої минув */
  frameKey?: string | null
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

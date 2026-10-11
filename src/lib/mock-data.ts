import type {
  Community,
  Conversation,
  FeedPage,
  FeedPrefs,
  FeedQuery,
  FeedTab,
  Notification,
  Post,
  PostReason,
  Trend,
  User,
} from "@/types"
import { MOCK_NOW, minutesAgo } from "./format"
import { computeExpiry } from "./glow"

/* ─────────────────────────── Користувачі ─────────────────────────── */

const u = (p: Partial<User> & Pick<User, "id" | "username" | "name">): User => ({
  bio: "",
  status: "",
  joinedAt: "2025-09-01T10:00:00.000Z",
  followers: 120,
  following: 80,
  postsCount: 40,
  ...p,
})

export const currentUser: User = u({
  id: "u_me",
  accentColor: "#3b8eff",
  bannerStyle: "aurora",
  username: "ozhaaar",
  name: "Денис",
  bio: "Frontend-розробник · React, Next.js, Zustand. Роблю інтерфейси, які приємно клацати.",
  status: "пишу Lumyn: стрічка, профілі, спільноти",
  location: "Київ",
  website: "github.com/user4032",
  coverUrl: "/mock/cover-1.jpg",
  joinedAt: "2024-09-02T10:00:00.000Z",
  followers: 1284,
  following: 312,
  postsCount: 186,
  verified: true,
  online: true,
  statusExpiresAt: minutesAgo(-60 * 5),
  widgets: { top4: ["u_olena", "u_maksym", "u_sofia", "u_andriy"], now_playing: { title: "Нічне місто", artist: "Lumyn FM" } },
})

export const users: User[] = [
  currentUser,
  u({
    id: "u_olena",
  accentColor: "#ff3d81",
  bannerStyle: "aurora",
    username: "olena",
    name: "Олена Коваль",
    bio: "Product designer. Типографіка, сітки, дрібні анімації.",
    status: "збираю дизайн-систему з нуля",
    location: "Львів",
    coverUrl: "/mock/cover-2.jpg",
    followers: 8420,
    following: 410,
    postsCount: 932,
    verified: true,
    online: true,
  }),
  u({
    id: "u_maksym",
  accentColor: "#a3e635",
  bannerStyle: "grid",
    username: "maksym_dev",
    name: "Максим Бондар",
    bio: "Frontend @ стартап. TypeScript-ентузіаст.",
    status: "type-safe або ніяк",
    location: "Харків",
    coverUrl: "/mock/cover-3.jpg",
    followers: 3110,
    following: 220,
    postsCount: 514,
    online: true,
  }),
  u({
    id: "u_iryna",
  accentColor: "#8b5cf6",
  bannerStyle: "mesh",
    username: "iryna.ml",
    name: "Ірина Мельник",
    bio: "ML engineer. Пишу про LLM без хайпу.",
    status: "fine-tuning у прогресі…",
    location: "Дніпро",
    followers: 12900,
    following: 180,
    postsCount: 1204,
    verified: true,
  }),
  u({
    id: "u_andriy",
  accentColor: "#2dd4bf",
  bannerStyle: "grid",
    username: "andriy_ops",
    name: "Андрій Ткаченко",
    bio: "Backend & DevOps. Postgres — моя суперсила.",
    status: "EXPLAIN ANALYZE усього",
    location: "Одеса",
    followers: 2210,
    following: 340,
    postsCount: 377,
  }),
  u({
    id: "u_sofia",
  accentColor: "#ffb224",
  bannerStyle: "aurora",
    username: "sofia.codes",
    name: "Софія Лисенко",
    bio: "Студентка КПІ, фронтенд і доступність.",
    status: "a11y — це не опція",
    location: "Київ",
    followers: 940,
    following: 510,
    postsCount: 221,
    online: true,
  }),
  u({
    id: "u_nazar",
  accentColor: "#ff6b4a",
  bannerStyle: "mesh",
    username: "nazar",
    name: "Назар Олійник",
    bio: "Мобільна розробка, Flutter і трохи Rust.",
    status: "",
    location: "Тернопіль",
    followers: 1530,
    following: 260,
    postsCount: 298,
  }),
  u({
    id: "u_daria",
  accentColor: "#7dd3fc",
  bannerStyle: "aurora",
    username: "daria.ux",
    name: "Дарія Савчук",
    bio: "UX-дослідниця. Інтерв'ю, прототипи, кава.",
    status: "шукаю респондентів для тесту",
    location: "Вінниця",
    followers: 2760,
    following: 390,
    postsCount: 402,
  }),
  u({
    id: "u_vlad",
    accentColor: "#2dd4bf",
    bannerStyle: "mesh",
    username: "vlad.makes",
    name: "Влад Гнатюк",
    bio: "18, роблю ігри на Godot. Тут новенький 👋",
    status: "перший тиждень у Lumyn",
    location: "Житомир",
    joinedAt: "2026-10-05T10:00:00.000Z",
    followers: 38,
    following: 64,
    postsCount: 3,
  }),
  u({
    id: "u_mila",
    accentColor: "#ff3d81",
    bannerStyle: "aurora",
    username: "mila.draws",
    name: "Міла",
    bio: "малюю котів і небо",
    status: "",
    joinedAt: "2026-09-20T10:00:00.000Z",
    followers: 120,
    following: 98,
    postsCount: 41,
    isPrivate: true,
    dmPolicy: "followers",
  }),
  u({
    id: "u_taras",
    accentColor: "#8b5cf6",
    bannerStyle: "grid",
    username: "taras.ui",
    name: "Тарас Мороз",
    bio: "Design engineer. Figma → код без болю.",
    status: "",
    location: "Львів",
    followers: 4310,
    following: 210,
    postsCount: 640,
  }),
]

export const userById = (id: string) => users.find((x) => x.id === id)
export const getUserByUsername = (username: string) =>
  users.find((x) => x.username === decodeURIComponent(username).replace(/^@/, ""))

const [, olena, maksym, iryna, andriy, sofia, nazar, daria, vlad, , taras] = users

/* ─────────────────────────── Спільноти ─────────────────────────── */

export const communities: Community[] = [
  {
    id: "c_frontend",
    slug: "frontend-ua",
    name: "Frontend UA",
    description:
      "Найбільша українськомовна спільнота фронтенд-розробників. React, Next.js, CSS, перформанс і кар'єра.",
    coverUrl: "/mock/c-1.jpg",
    members: 18420,
    postsPerDay: 140,
    isPrivate: false,
    role: "admin",
    tags: ["React", "Next.js", "CSS"],
    hue: 215,
  },
  {
    id: "c_design",
    slug: "design-systems",
    name: "Design Systems",
    description: "Токени, компоненти, Figma та код. Як будувати системи, що масштабуються.",
    coverUrl: "/mock/c-2.jpg",
    members: 6210,
    postsPerDay: 38,
    isPrivate: false,
    role: "member",
    tags: ["Figma", "Tokens", "UI"],
    hue: 280,
  },
  {
    id: "c_kpi",
    slug: "kpi-students",
    name: "КПІ · Студенти",
    description: "Лаби, розклад, меми і взаємодопомога. Тільки для студентів.",
    coverUrl: "/mock/c-3.jpg",
    members: 3290,
    postsPerDay: 64,
    isPrivate: true,
    role: "member",
    tags: ["Навчання", "Лаби"],
    hue: 150,
  },
  {
    id: "c_postgres",
    slug: "postgres-ua",
    name: "Postgres UA",
    description: "Запити, індекси, RLS і все, що треба знати про найкращу БД.",
    coverUrl: "/mock/cover-3.jpg",
    members: 2140,
    postsPerDay: 12,
    isPrivate: false,
    role: null,
    tags: ["SQL", "Supabase"],
    hue: 200,
  },
  {
    id: "c_ai",
    slug: "ai-builders",
    name: "AI Builders",
    description: "Будуємо продукти з LLM: агенти, RAG, оцінювання якості.",
    coverUrl: "/mock/cover-2.jpg",
    members: 9870,
    postsPerDay: 85,
    isPrivate: false,
    role: null,
    tags: ["LLM", "Agents"],
    hue: 30,
  },
  {
    id: "c_mobile",
    slug: "mobile-dev",
    name: "Mobile Dev",
    description: "Flutter, React Native, Swift, Kotlin — обговорюємо мобільну розробку.",
    coverUrl: "/mock/c-1.jpg",
    members: 4120,
    postsPerDay: 22,
    isPrivate: false,
    role: null,
    tags: ["Flutter", "iOS"],
    hue: 340,
  },
]

export const getCommunity = (slug: string) => communities.find((c) => c.slug === slug)

/* ─────────────────────────── Дописи ─────────────────────────── */

const p = (x: Partial<Post> & Pick<Post, "id" | "author" | "content">): Post => {
  const post: Post = {
    media: [],
    poll: null,
    createdAt: minutesAgo(30),
    lights: 0,
    lit: false,
    replies: 0,
    reposts: 0,
    reposted: false,
    community: null,
    mode: "permanent",
    expiresAt: null,
    audience: "public",
    ...x,
  }
  if (post.mode === "glow") post.expiresAt = computeExpiry(post.createdAt, post.lights)
  return post
}

const basePosts: Post[] = [
  p({
    id: "p1",
    author: olena,
    content:
      "Нарешті зібрала токени кольорів для нової дизайн-системи. Правило одне: один акцентний колір, усе інше — відтінки сірого. Інтерфейс одразу став спокійнішим.",
    media: [{ type: "image", url: "/mock/post-1.jpg", width: 1200, height: 800, alt: "Робоче місце дизайнера" }],
    createdAt: minutesAgo(12),
    lights: 1284,
    replies: 86,
    reposts: 142,
  }),
  p({
    id: "p2",
    author: maksym,
    community: { slug: "frontend-ua", name: "Frontend UA" },
    content: "Маленький хук, який я копіюю в кожен проєкт. Оптимістичні оновлення без бібліотек:",
    media: [
      {
        type: "code",
        lang: "tsx",
        filename: "use-optimistic-light.ts",
        code: `export function useOptimisticLight(post: Post) {
  const [state, setState] = useState(post)

  async function toggle() {
    const prev = state
    setState((s) => ({
      ...s,
      lit: !s.lit,
      lights: s.lights + (s.lit ? -1 : 1),
    }))
    const res = await toggleLight(post.id)
    if (!res.ok) setState(prev) // відкат
  }

  return [state, toggle] as const
}`,
      },
    ],
    createdAt: minutesAgo(47),
    lights: 642,
    replies: 41,
    reposts: 98,
    lit: true,
  }),
  p({
    id: "p3",
    author: iryna,
    content: "Що використовуєте для локального запуску LLM у 2026?",
    poll: {
      options: ["Ollama", "LM Studio", "llama.cpp напряму", "Не запускаю локально"],
      votes: [412, 188, 96, 230],
      votedIndex: null,
      endsAt: minutesAgo(-60 * 20),
    },
    createdAt: minutesAgo(95),
    lights: 318,
    replies: 120,
    reposts: 24,
  }),
  p({
    id: "p4",
    author: andriy,
    community: { slug: "postgres-ua", name: "Postgres UA" },
    content:
      "Нагадування: RLS у Supabase — це не «додатковий захист», а основний. Без політик ваш anon key = відкрита база. Перевірте зараз: select tablename from pg_tables where not rowsecurity;",
    createdAt: minutesAgo(160),
    lights: 2011,
    replies: 77,
    reposts: 530,
    reposted: true,
  }),
  p({
    id: "p5",
    author: sofia,
    content:
      "Захистила лабу з веб-доступності 🎉 Найбільше викладача вразило, що вся сторінка працює з клавіатури, а фокус видно навіть у темній темі.",
    createdAt: minutesAgo(240),
    lights: 189,
    replies: 23,
    reposts: 6,
  }),
  p({
    id: "p6",
    author: daria,
    content: "Вечірній Київ з 24 поверху. Іноді треба просто відійти від Figma.",
    media: [{ type: "image", url: "/mock/post-2.jpg", width: 1200, height: 800, alt: "Вечірнє місто" }],
    createdAt: minutesAgo(320),
    lights: 954,
    replies: 31,
    reposts: 40,
  }),
  p({
    id: "p7",
    author: nazar,
    community: { slug: "mobile-dev", name: "Mobile Dev" },
    content: "Rust + Flutter через flutter_rust_bridge — це магія. Парсинг 50 МБ JSON за 0.4 с на телефоні.",
    media: [
      {
        type: "code",
        lang: "rust",
        filename: "api.rs",
        code: `pub fn parse_feed(raw: String) -> Vec<Post> {
    serde_json::from_str::<Vec<Post>>(&raw)
        .unwrap_or_default()
        .into_iter()
        .filter(|p| !p.content.is_empty())
        .collect()
}`,
      },
    ],
    createdAt: minutesAgo(410),
    lights: 433,
    replies: 18,
    reposts: 51,
  }),
  p({
    id: "p8",
    author: olena,
    repostedBy: maksym,
    content:
      "Мікроанімації мають бути відчутними, але не помітними. 150–200 мс, ease-out, і ніколи не анімуйте layout на кожен hover.",
    createdAt: minutesAgo(520),
    lights: 3120,
    replies: 140,
    reposts: 880,
  }),
  p({
    id: "p9",
    author: maksym,
    content: "Як ви називаєте гілки?",
    poll: {
      options: ["feature/назва", "feat/JIRA-123", "просто назва", "main 😈"],
      votes: [540, 310, 120, 88],
      votedIndex: 0,
    },
    createdAt: minutesAgo(700),
    lights: 221,
    replies: 64,
    reposts: 12,
  }),
  p({
    id: "p10",
    author: iryna,
    content:
      "Оцінювання якості LLM-фіч — найнедооціненіша частина. Без eval-набору ви не знаєте, чи новий промпт кращий, чи вам просто так здається.",
    media: [{ type: "image", url: "/mock/post-3.jpg", width: 1200, height: 900, alt: "Ноутбук із графіками" }],
    createdAt: minutesAgo(900),
    lights: 1720,
    replies: 95,
    reposts: 310,
  }),
  p({
    id: "p11",
    author: andriy,
    content: "Індекс, який прискорив нашу стрічку в 40 разів:",
    media: [
      {
        type: "code",
        lang: "sql",
        filename: "0002_feed_index.sql",
        code: `create index posts_author_created_idx
  on public.posts (author_id, created_at desc);

-- стрічка «Підписки»
select p.* from posts p
join follows f on f.following_id = p.author_id
where f.follower_id = auth.uid()
order by p.created_at desc
limit 20;`,
      },
    ],
    createdAt: minutesAgo(1300),
    lights: 870,
    replies: 37,
    reposts: 205,
  }),
  p({
    id: "p12",
    author: sofia,
    community: { slug: "kpi-students", name: "КПІ · Студенти" },
    content: "Хто вже здав курсову з ООП? Поділіться, як оформлювали UML-діаграми 🙏",
    media: [{ type: "image", url: "/mock/post-4.jpg", width: 1200, height: 800, alt: "Ліс" }],
    createdAt: minutesAgo(1800),
    lights: 64,
    replies: 29,
    reposts: 3,
  }),
]

/* ── Glow-дописи, близькі друзі й рекомендації ───────────────────── */

const glowPosts: Post[] = [
  p({
    id: "g1",
    author: maksym,
    mode: "glow",
    content: "Задеплоїв свій перший пет-проєкт на Vercel о 3 ночі. Ще одне світло — і цей пост лишиться тут назавжди 👀",
    createdAt: minutesAgo(45),
    lights: 24,
    replies: 12,
    reposts: 3,
  }),
  p({
    id: "g2",
    author: olena,
    mode: "glow",
    content: "Фотодамп із вихідних: плівка, кава й трохи Львова",
    media: [{ type: "image", url: "/mock/photo-2.jpg", width: 1200, height: 800, alt: "Фото з вихідних" }],
    createdAt: minutesAgo(60 * 5),
    lights: 14,
    lit: true,
    replies: 9,
    reposts: 2,
  }),
  p({
    id: "g3",
    author: sofia,
    mode: "glow",
    content: "Хто сьогодні ввечері на хакатоні в КПІ? Шукаю дизайнера в команду, ідея — застосунок для обміну конспектами 📚",
    createdAt: minutesAgo(60 * 20),
    lights: 3,
    replies: 6,
    reposts: 1,
  }),
  p({
    id: "g4",
    author: daria,
    mode: "glow",
    content: "Швидке опитування для дослідження: як ви дізнаєтесь про нові застосунки?",
    poll: { options: ["Від друзів", "TikTok / Reels", "Telegram-канали", "App Store"], votes: [61, 88, 40, 9], votedIndex: null },
    createdAt: minutesAgo(60 * 22 + 30),
    lights: 1,
    replies: 4,
  }),
  p({
    id: "cf1",
    author: olena,
    audience: "close_friends",
    content: "Тільки для своїх: мене взяли в студію мрії 🥹 Офіційно скажу в понеділок, поки тсс.",
    createdAt: minutesAgo(35),
    lights: 18,
    replies: 7,
  }),
  p({
    id: "n1",
    author: vlad,
    content: "Привіт, Lumyn! Мені 18, роблю інді-гру на Godot про кота-кур'єра. Буду викладати девлоги сюди — підкажіть, з чого почати? 🐈‍⬛",
    createdAt: minutesAgo(190),
    lights: 9,
    replies: 7,
    reposts: 4,
  }),
  p({
    id: "t1",
    author: taras,
    community: { slug: "design-systems", name: "Design Systems" },
    content: "Зробив токени відступів, які однаково звучать у Figma і в Tailwind. Секрет: 4-піксельна сітка + назви за ролями, а не за розмірами.",
    media: [
      {
        type: "code",
        lang: "css",
        filename: "tokens.css",
        code: `@theme {
  --space-inline: 0.75rem;  /* 12px */
  --space-stack:  1rem;     /* 16px */
  --space-section: 3.5rem;  /* 56px */
}`,
      },
    ],
    createdAt: minutesAgo(140),
    lights: 312,
    replies: 28,
    reposts: 61,
  }),
]

/* ── Сигнали для ранжування (у Supabase їх рахує for_you_feed) ─────── */

/** кого «я» читаю в демо */
export const followingIds = new Set(["u_olena", "u_maksym", "u_andriy", "u_sofia"])

type Signals = { friendLitBy?: User; communityPopular?: boolean; newAuthor?: boolean }
const signals: Record<string, Signals> = {
  p3: { friendLitBy: olena },
  p6: { friendLitBy: maksym },
  g4: { friendLitBy: sofia },
  n1: { newAuthor: true, friendLitBy: sofia },
  t1: { communityPopular: true },
  p12: { communityPopular: true },
}

const hoursOld = (iso: string) => (MOCK_NOW - Date.parse(iso)) / 3_600_000
const hasMedia = (post: Post) => post.media.length > 0 || Boolean(post.poll)

/** Та сама формула, що й у SQL-функції public.for_you_feed (0002_mvp.sql). */
export function scorePost(post: Post, prefs: FeedPrefs) {
  const baseId = post.id.replace(/-r\d+$/, "")
  const sig = signals[baseId] ?? {}
  const followed = followingIds.has(post.author.id)
  const recency = 1 / Math.pow(hoursOld(post.createdAt) + 2, 0.6)
  const social = followed
    ? 1 + 2 * (1 - prefs.social)
    : 0.4 +
      prefs.social *
        (1 + 2 * (sig.friendLitBy ? 1 : 0) + 1.5 * (sig.communityPopular ? 1 : 0) + (sig.newAuthor ? 1 : 0) + Math.log(1 + post.lights) / 3)
  const media = 1 + (prefs.media - 0.5) * (hasMedia(post) ? 1.6 : -1.6)
  const glow = post.mode === "glow" ? 1.15 : 1
  return recency * social * media * glow
}

export function reasonFor(post: Post): PostReason | null {
  if (followingIds.has(post.author.id) || post.author.id === currentUser.id) return null
  const sig = signals[post.id.replace(/-r\d+$/, "")] ?? {}
  if (sig.friendLitBy) return { type: "friend_light", actor: sig.friendLitBy }
  if (sig.communityPopular && post.community) return { type: "community_popular", community: post.community }
  if (sig.newAuthor) return { type: "new_author" }
  return { type: "popular" }
}

export const PAGE_SIZE = 6
const TOTAL_PAGES = 5

/** Увесь пул дописів: живі + «старіші» копії для нескінченного скролу. */
function buildPool(): Post[] {
  const live = [...glowPosts, ...basePosts]
  const out: Post[] = [...live]
  let round = 1
  while (out.length < PAGE_SIZE * TOTAL_PAGES + live.length) {
    for (const post of basePosts) {
      out.push({
        ...post,
        id: `${post.id}-r${round}`,
        createdAt: new Date(Date.parse(post.createdAt) - round * 2 * 86_400_000).toISOString(),
        lights: Math.round(post.lights / (round + 1.5)),
        replies: Math.round(post.replies / (round + 1.5)),
        reposts: Math.round(post.reposts / (round + 1.5)),
        lit: false,
        reposted: false,
      })
    }
    round++
  }
  return out
}

let poolCache: Post[] | null = null
const pool = () => (poolCache ??= buildPool())

/** Ранжований / хронологічний список для вкладки. */
export function feedFor(tab: FeedTab, prefs: FeedPrefs = { social: 0.5, media: 0.5 }): Post[] {
  const visible = pool().filter((x) => !x.replyTo)
  if (tab === "following") {
    return visible
      .filter((x) => followingIds.has(x.author.id))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }
  return visible
    .map((post) => ({ post, score: scorePost(post, prefs) }))
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => ({ ...post, reason: reasonFor(post) }))
}

export function getMockFeedPage(tab: FeedTab, q: FeedQuery): FeedPage {
  const exclude = new Set(q.exclude ?? [])
  const hidden = new Set(q.hiddenAuthors ?? [])
  const all = feedFor(tab, q.prefs).filter((x) => !exclude.has(x.id) && !hidden.has(x.author.id))
  const posts = all.slice(0, PAGE_SIZE)
  const nextCursor = all.length > PAGE_SIZE && q.cursor + 1 < TOTAL_PAGES + 2 ? q.cursor + 1 : null
  return { posts, nextCursor }
}

export const getPost = (id: string) => pool().find((x) => x.id === id) ?? null

export const postsByUser = (userId: string) => {
  const own = [...glowPosts, ...basePosts]
    .filter((x) => x.author.id === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  if (own.length > 0) return own
  // для поточного користувача — кілька власних дописів
  return [
    p({
      id: `w-${userId}-1`,
      author: userById(userId) ?? currentUser,
      content: "Перший допис на моїй стіні в Lumyn. Тут буде багато про фронтенд і дизайн 🖤",
      createdAt: minutesAgo(60 * 26),
      lights: 48,
      replies: 6,
      reposts: 2,
    }),
    p({
      id: `w-${userId}-2`,
      author: userById(userId) ?? currentUser,
      content: "Поки бекенд готується, я роблю інтерфейс на мок-даних. Найкращий спосіб не чекати.",
      media: [{ type: "image", url: "/mock/post-3.jpg", width: 1200, height: 900, alt: "Ноутбук" }],
      createdAt: minutesAgo(60 * 50),
      lights: 112,
      replies: 14,
      reposts: 9,
    }),
  ]
}

export const postsByCommunity = (slug: string) =>
  pool().filter((x) => x.community?.slug === slug).slice(0, 8)

export const repliesFor = (postId: string): Post[] => [
  p({
    id: `${postId}-reply-1`,
    author: sofia,
    content: "Дуже вчасно, якраз думала над цим. Дякую!",
    createdAt: minutesAgo(8),
    lights: 24,
    replies: 1,
    replyTo: postId,
  }),
  p({
    id: `${postId}-reply-2`,
    author: andriy,
    content: "Додам: не забудьте про індекси, інакше на великих обсягах усе поїде.",
    createdAt: minutesAgo(5),
    lights: 41,
    replies: 3,
    replyTo: postId,
  }),
  p({
    id: `${postId}-reply-3`,
    author: daria,
    content: "А можна приклад того, як це виглядає у UI? 👀",
    createdAt: minutesAgo(2),
    lights: 7,
    replyTo: postId,
  }),
]

/* ─────────────────────────── Права колонка ─────────────────────────── */

export const trends: Trend[] = [
  { tag: "Next.js 16", category: "Технології", posts: 12400 },
  { tag: "Supabase", category: "Бази даних", posts: 5320 },
  { tag: "ДизайнСистеми", category: "Дизайн", posts: 2810 },
  { tag: "Сесія", category: "Навчання · Тренд", posts: 1940 },
  { tag: "RustLang", category: "Програмування", posts: 1205 },
]

export const suggestedUsers = [iryna, andriy, daria]

/* ─────────────────────────── Повідомлення ─────────────────────────── */

const msg = (id: string, senderId: string, content: string, m: number) => ({
  id,
  senderId,
  content,
  createdAt: minutesAgo(m),
})

export const conversations: Conversation[] = [
  {
    id: "olena",
    user: olena,
    unread: 2,
    messages: [
      msg("m1", "u_olena", "Привіт! Глянула твій макет стрічки 👀", 180),
      msg("m2", "u_me", "Привіт! І як? Чесно 😅", 176),
      msg("m3", "u_olena", "Дуже чисто. Але я б зменшила відступи в картці допису до 16px", 170),
      msg("m4", "u_me", "Згоден, зараз поправлю. А бордери 1px норм?", 165),
      msg("m5", "u_olena", "Так, ідеально. Тільки в світлій темі зроби їх трохи світлішими", 20),
      msg("m6", "u_olena", "І додай skeleton для профілю, щоб не було стрибків", 18),
    ],
  },
  {
    id: "maksym_dev",
    user: maksym,
    unread: 0,
    messages: [
      msg("m7", "u_maksym", "Кинув PR з типами для Supabase", 300),
      msg("m8", "u_me", "Топ, дивлюсь", 290),
      msg("m9", "u_me", "Змерджив, дякую!", 240),
    ],
  },
  {
    id: "sofia.codes",
    user: sofia,
    unread: 1,
    messages: [msg("m10", "u_sofia", "Допоможеш з aria-атрибутами для діалогу?", 60)],
  },
  {
    id: "andriy_ops",
    user: andriy,
    unread: 0,
    messages: [
      msg("m11", "u_me", "Як краще зробити лічильники лайків?", 2000),
      msg("m12", "u_andriy", "Тригерами. View теж ок, але на великій стрічці тригери швидші", 1990),
    ],
  },
  {
    id: "daria.ux",
    user: daria,
    unread: 0,
    messages: [msg("m13", "u_daria", "Дякую за участь у тесті! 🙌", 4300)],
  },
]

export const getConversation = (id: string) => conversations.find((c) => c.id === id)

/* ─────────────────────────── Сповіщення ─────────────────────────── */

/** Лише справжні події, без «фейкових» нагадувань і без стріків. */
export const notifications: Notification[] = [
  { id: "n1", type: "light", actor: olena, postId: "w-u_me-1", preview: "Перший допис на моїй стіні в Lumyn…", createdAt: minutesAgo(3), read: false },
  { id: "n2", type: "friend_joined", actor: vlad, preview: "приєднався за вашим інвайтом", createdAt: minutesAgo(9), read: false },
  { id: "n3", type: "follow", actor: iryna, createdAt: minutesAgo(14), read: false },
  { id: "n4", type: "reply", actor: maksym, postId: "p2", preview: "Додай ще abort controller, і буде ідеально", createdAt: minutesAgo(38), read: false },
  { id: "n5", type: "mention", actor: sofia, postId: "p5", preview: "@ozhaaar дякую за допомогу з фокусом!", createdAt: minutesAgo(65), read: true },
  { id: "n6", type: "light", actor: taras, postId: "w-u_me-2", preview: "Поки бекенд готується, я роблю інтерфейс…", createdAt: minutesAgo(90), read: true },
  { id: "n7", type: "repost", actor: andriy, postId: "w-u_me-2", preview: "Поки бекенд готується, я роблю інтерфейс…", createdAt: minutesAgo(140), read: true },
  { id: "n8", type: "message", actor: olena, preview: "І додай skeleton для профілю", createdAt: minutesAgo(18), read: false },
  { id: "n9", type: "light", actor: daria, postId: "w-u_me-1", preview: "Перший допис на моїй стіні в Lumyn…", createdAt: minutesAgo(60 * 26), read: true },
  { id: "n10", type: "follow", actor: nazar, createdAt: minutesAgo(60 * 30), read: true },
  { id: "n11", type: "reply", actor: daria, postId: "p1", preview: "А можна приклад, як це виглядає у UI?", createdAt: minutesAgo(60 * 49), read: true },
].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) as Notification[]

/** Інвайти поточного користувача (5 на людину) */
export const myInvites = [
  { code: "LMN7-K2QX", usedBy: vlad, usedAt: minutesAgo(9) },
  { code: "GLOW-8RTZ", usedBy: null, usedAt: null },
  { code: "SPRK-4MHD", usedBy: null, usedAt: null },
  { code: "NOVA-6WPE", usedBy: null, usedAt: null },
  { code: "LITE-3JYC", usedBy: null, usedAt: null },
]

/** Демо-коди, які приймає онбординг без Supabase */
export const DEMO_INVITE_CODES = ["LUMN-2026", "GLOW-8RTZ", "SPRK-4MHD", "NOVA-6WPE", "LITE-3JYC"]

/** Зайняті / заброньовані ніки в демо */
export const takenHandles = new Set([...users.map((x) => x.username), "admin", "lumyn", "support", "root"])

export const photos = ["/mock/photo-1.jpg", "/mock/photo-2.jpg", "/mock/photo-3.jpg", "/mock/photo-4.jpg", "/mock/photo-5.jpg", "/mock/photo-6.jpg"]

export { MOCK_NOW }

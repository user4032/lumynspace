import "server-only"
import type { Post } from "@/types"
import type { FeedPostRow } from "@/types/database"
import { getPost } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { accentForeground, DEFAULT_ACCENT, isHexColor } from "@/lib/accent"
import { GLOW, remainingLabel } from "@/lib/glow"
import { MOCK_NOW } from "@/lib/mock-data"
import { formatCount, plural } from "@/lib/format"
import { PUBLIC_PROFILE_COLUMNS, profileRowToUser, type PublicProfileRow } from "@/lib/profiles"
import { mapFeedRow } from "@/lib/feed-map"
import { hiResAvatarUrl } from "@/lib/avatar"
import { VerifiedMarkStatic } from "@/components/verified-badge"

const MARK =
  "M12 1.25C13.03 7.7 16.1 10.93 22.25 12C16.1 13.07 13.03 16.3 12 22.75C10.97 16.3 7.9 13.07 1.75 12C7.9 10.93 10.97 7.7 12 1.25Z"

const strip = (s: string) => s.replace(/[\u2600-\u27BF]|[\u{1F000}-\u{1FFFF}]/gu, "").replace(/\s+/g, " ").trim()

export type ShareCard = {
  name: string
  handle: string
  text: string
  accent: string
  fg: string
  glow: boolean
  permanent: boolean
  lifeLabel: string
  life: number
  lights: string
  replies: string
  reposts: string
  views: string
  /** data: URL аватара (вже завантажений на сервері, щоб не було «сірого кола») */
  avatar: string | null
  verified: boolean
  site: string
}

type CardPost = Pick<Post, "content" | "mode" | "expiresAt" | "lights" | "replies" | "reposts" | "views"> & {
  hasVideo?: boolean
  author: Pick<Post["author"], "name" | "username" | "accentColor" | "avatarUrl" | "verified">
}

/** Допис для картки: мок або feed_posts (RLS — анонім бачить лише публічне й живе). */
async function loadPost(id: string): Promise<CardPost | null> {
  if (isMockMode) return getPost(id) ?? null
  const supabase = await getSupabaseServerClient()
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await supabase.from("feed_posts").select("*").eq("id", id).maybeSingle()
  const row = data as FeedPostRow | null
  if (!row) return null
  const { data: views } = await (supabase.rpc as unknown as (fn: string, args: object) => PromiseLike<{ data: number | null }>)("post_view_count", { p_post: id })
  return {
    content: row.content,
    hasVideo: Array.isArray(row.media) && (row.media as { type?: string }[]).some((m) => m?.type === "video"),
    mode: row.mode,
    expiresAt: row.expires_at,
    lights: row.light_count,
    replies: row.reply_count,
    reposts: row.repost_count,
    views: typeof views === "number" ? views : 0,
    author: {
      name: row.author_display_name || row.author_username,
      username: row.author_username,
      accentColor: row.author_accent_color,
      avatarUrl: row.author_avatar_url ?? undefined,
      verified: row.author_verified ?? false,
    },
  }
}

/** Аватар → data: URL. Відносні шляхи (мок) і збої мережі → null (тоді градієнт). */
async function avatarDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null
  try {
    const res = await fetch(hiResAvatarUrl(url) ?? url, { signal: AbortSignal.timeout(4000) })
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !/^image\/(png|jpe?g|gif|webp)/.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}

export async function shareCardFor(id: string): Promise<ShareCard | null> {
  const post = await loadPost(id)
  if (!post) return null
  const now = isMockMode ? MOCK_NOW : Date.now()
  const accent = isHexColor(post.author.accentColor ?? "") ? (post.author.accentColor as string) : DEFAULT_ACCENT
  const clean = strip(post.content)
  const glow = post.mode === "glow"
  const permanent = glow && !post.expiresAt
  const ms = post.expiresAt ? Date.parse(post.expiresAt) - now : Infinity
  const life = glow && post.expiresAt ? Math.max(0, Math.min(1, ms / (GLOW.baseHours * 3_600_000))) : 1
  return {
    name: post.author.name,
    handle: post.author.username,
    text: clean.length > 280 ? `${clean.slice(0, 280)}…` : clean || (post.hasVideo ? "Допис із відео" : "Допис із вкладенням"),
    accent,
    fg: accentForeground(accent),
    glow,
    permanent,
    lifeLabel: glow ? (permanent ? "назавжди" : remainingLabel(post.expiresAt, now)) : "",
    life,
    lights: formatCount(post.lights),
    replies: formatCount(post.replies),
    reposts: formatCount(post.reposts ?? 0),
    views: formatCount(post.views ?? 0),
    avatar: await avatarDataUrl(post.author.avatarUrl),
    verified: Boolean(post.author.verified),
    site: "lumyn.space",
  }
}

/** OG-картка профілю: аватар, статистика й останній допис. */
export type ProfileShareCard = {
  name: string
  handle: string
  bio: string
  accent: string
  avatar: string | null
  verified: boolean
  followers: number
  following: number
  posts: number
  latest: { text: string; image: string | null } | null
  site: string
}

export async function shareCardForProfile(username: string): Promise<ProfileShareCard | null> {
  const handle = username.trim().toLowerCase()
  if (!/^[a-z0-9_]{1,24}$/.test(handle)) return null
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null
  const { data } = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("username", handle).maybeSingle()
  if (!data) return null
  const user = profileRowToUser(data as PublicProfileRow)
  const accent = isHexColor(user.accentColor ?? "") ? (user.accentColor as string) : DEFAULT_ACCENT

  const { data: postRow } = await supabase
    .from("feed_posts")
    .select("*")
    .eq("author_id", user.id)
    .is("reply_to", null)
    .is("repost_of", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let latest: ProfileShareCard["latest"] = null
  if (postRow) {
    const post = mapFeedRow(postRow as FeedPostRow)
    const clean = strip(post.content)
    const image = post.media.find((m) => m.type === "image")
    const imageUrl = image && image.type === "image" ? image.url : null
    if (clean || imageUrl) {
      latest = {
        text: clean.length > 200 ? `${clean.slice(0, 200)}…` : clean || "Допис із фото",
        image: await avatarDataUrl(imageUrl),
      }
    }
  }

  const bio = strip(user.bio)
  return {
    name: user.name,
    handle: user.username,
    bio: bio.length > 150 ? `${bio.slice(0, 150)}…` : bio,
    accent,
    avatar: await avatarDataUrl(user.avatarUrl),
    verified: Boolean(user.verified),
    followers: user.followers,
    following: user.following,
    posts: user.postsCount,
    latest,
    site: "lumyn.space",
  }
}

/** Спільний макет OG-карток (1200×630 і сторіз 1080×1350). */
export function ShareCardView({ card, story = false }: { card: ShareCard; story?: boolean }) {
  const pad = story ? 96 : 72
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#050507",
        color: "#ededed",
        fontFamily: "Geist",
        padding: pad,
        position: "relative",
      }}
    >
      {/* пляма акценту автора */}
      <div
        style={{
          position: "absolute",
          top: story ? -260 : -220,
          right: story ? -180 : -160,
          width: story ? 760 : 620,
          height: story ? 760 : 620,
          borderRadius: 9999,
          background: `radial-gradient(closest-side, ${card.accent}, transparent)`,
          opacity: 0.55,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: story ? -300 : -260,
          left: -200,
          width: 560,
          height: 560,
          borderRadius: 9999,
          background: `radial-gradient(closest-side, ${card.accent}, transparent)`,
          opacity: 0.25,
          display: "flex",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill={card.accent}>
            <path d={MARK} />
          </svg>
          Lumyn
        </div>
        {card.glow && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 24,
              color: "#ffb224",
              background: "rgba(255,178,36,0.12)",
              borderRadius: 999,
              padding: "8px 20px",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffb224">
              <path d={MARK} />
            </svg>
            {card.permanent ? "назавжди" : `Світло · ${card.lifeLabel}`}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {card.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) потребує <img>
            <img
              src={card.avatar}
              alt=""
              width={story ? 96 : 72}
              height={story ? 96 : 72}
              style={{ borderRadius: 999, objectFit: "cover", boxShadow: `0 0 40px ${card.accent}` }}
            />
          ) : (
            <div
              style={{
                width: story ? 96 : 72,
                height: story ? 96 : 72,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${card.accent}, #000)`,
                boxShadow: `0 0 40px ${card.accent}`,
              }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: story ? 42 : 34, fontWeight: 600 }}>
              {card.name}
              {card.verified && <VerifiedMarkStatic size={story ? 34 : 28} />}
            </div>
            <div style={{ fontSize: story ? 30 : 24, color: "#a1a1a1" }}>{`@${card.handle}`}</div>
          </div>
        </div>

        <div
          style={{
            marginTop: story ? 56 : 40,
            fontSize: story ? 58 : 46,
            lineHeight: 1.28,
            letterSpacing: "-0.025em",
            display: "flex",
          }}
        >
          {card.text}
        </div>

        {card.glow && !card.permanent && (
          <div style={{ marginTop: 44, display: "flex", width: "100%", height: 8, borderRadius: 999, background: "#1c1c1f" }}>
            <div style={{ width: `${Math.round(card.life * 100)}%`, height: 8, borderRadius: 999, background: "#ffb224" }} />
          </div>
        )}

        <div style={{ marginTop: 40, display: "flex", gap: 40, fontSize: 26, color: "#a1a1a1" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, color: "#ffb224" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffb224"><path d={MARK} /></svg>
            {`${card.lights} світла`}
          </span>
          <span>{`${card.replies} відповідей`}</span>
          <span>{`${card.reposts} репостів`}</span>
          <span>{`${card.views} переглядів`}</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#6b6b70" }}>
        <span>{card.site}</span>
        <span>світло замість лайків</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: card.accent, display: "flex" }} />
    </div>
  )
}

/** OG-картка профілю 1200×630: зліва профіль і статистика, справа останній допис. */
export function ProfileShareCardView({ card }: { card: ProfileShareCard }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#050507",
        color: "#ededed",
        fontFamily: "Geist",
        padding: 72,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -220,
          right: -150,
          width: 620,
          height: 620,
          borderRadius: 9999,
          background: `radial-gradient(closest-side, ${card.accent}, transparent)`,
          opacity: 0.55,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -280,
          left: -200,
          width: 560,
          height: 560,
          borderRadius: 9999,
          background: `radial-gradient(closest-side, ${card.accent}, transparent)`,
          opacity: 0.22,
          display: "flex",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill={card.accent}>
            <path d={MARK} />
          </svg>
          Lumyn
        </div>
        <div style={{ display: "flex", alignItems: "center", fontSize: 24, color: "#a1a1a1" }}>профіль</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 44, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <div
              style={{
                display: "flex",
                padding: 5,
                borderRadius: 9999,
                background: card.accent,
                boxShadow: `0 0 46px ${card.accent}`,
              }}
            >
              {card.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) потребує <img>
                <img
                  src={card.avatar}
                  alt=""
                  width={116}
                  height={116}
                  style={{ borderRadius: 9999, objectFit: "cover", background: "#111114" }}
                />
              ) : (
                <div style={{ width: 116, height: 116, borderRadius: 9999, background: "linear-gradient(135deg, #2a2a31, #000)" }} />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 42, fontWeight: 600, letterSpacing: "-0.03em" }}>
                {card.name}
                {card.verified && <VerifiedMarkStatic size={30} />}
              </div>
              <div style={{ fontSize: 27, color: "#a1a1a1", marginTop: 4 }}>{`@${card.handle}`}</div>
            </div>
          </div>

          {card.bio && (
            <div style={{ marginTop: 28, fontSize: 26, lineHeight: 1.35, color: "#c9c9cf", display: "flex", maxWidth: 560 }}>
              {card.bio}
            </div>
          )}

          <div style={{ marginTop: 30, display: "flex", gap: 34, fontSize: 24, color: "#a1a1a1" }}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <b style={{ color: "#ededed", fontSize: 30, fontWeight: 600 }}>{formatCount(card.followers)}</b>
              {plural(card.followers, ["підписник", "підписники", "підписників"])}
            </span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <b style={{ color: "#ededed", fontSize: 30, fontWeight: 600 }}>{formatCount(card.following)}</b>
              {plural(card.following, ["підписка", "підписки", "підписок"])}
            </span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <b style={{ color: "#ededed", fontSize: 30, fontWeight: 600 }}>{formatCount(card.posts)}</b>
              {plural(card.posts, ["допис", "дописи", "дописів"])}
            </span>
          </div>
        </div>

        {card.latest && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 420,
              flexShrink: 0,
              padding: 24,
              gap: 14,
              borderRadius: 24,
              border: "1px solid #26262b",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ display: "flex", fontSize: 17, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7b7b84" }}>
              Останній допис
            </div>
            {card.latest.text && (
              <div style={{ display: "flex", fontSize: 24, lineHeight: 1.35, color: "#e6e6ea" }}>{card.latest.text}</div>
            )}
            {card.latest.image && (
              // eslint-disable-next-line @next/next/no-img-element -- ImageResponse (satori) потребує <img>
              <img
                src={card.latest.image}
                alt=""
                width={372}
                height={180}
                style={{ borderRadius: 16, objectFit: "cover", background: "#111114" }}
              />
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#6b6b70" }}>
        <span>{card.site}</span>
        <span>світло замість лайків</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: card.accent, display: "flex" }} />
    </div>
  )
}

export function BrandCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: "#050507",
        color: "#ededed",
        fontFamily: "Geist",
        padding: "72px",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: -200, right: -120, width: 640, height: 640, borderRadius: 9999, background: "radial-gradient(closest-side, #3b8eff, transparent)", opacity: 0.6, display: "flex" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 600 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="#3b8eff">
          <path d={MARK} />
        </svg>
        Lumyn
      </div>
      <div style={{ marginTop: 48, fontSize: 84, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.02, display: "flex", maxWidth: 900 }}>
        Соцмережа, яка не кричить.
      </div>
      <div style={{ marginTop: 28, fontSize: 32, color: "#a1a1a1", display: "flex" }}>Світло замість лайків · стрічка з кермом · без темних патернів</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: "#3b8eff", display: "flex" }} />
    </div>
  )
}

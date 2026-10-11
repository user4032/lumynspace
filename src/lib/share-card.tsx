import "server-only"
import type { Post } from "@/types"
import type { FeedPostRow } from "@/types/database"
import { getPost } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { accentForeground, DEFAULT_ACCENT, isHexColor } from "@/lib/accent"
import { GLOW, remainingLabel } from "@/lib/glow"
import { MOCK_NOW } from "@/lib/mock-data"
import { formatCount } from "@/lib/format"

const MARK =
  "M12 1.5c.4 5.6 4.9 10.1 10.5 10.5-5.6.4-10.1 4.9-10.5 10.5-.4-5.6-4.9-10.1-10.5-10.5C7.1 11.6 11.6 7.1 12 1.5Z"

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
  site: string
}

type CardPost = Pick<Post, "content" | "mode" | "expiresAt" | "lights" | "replies"> & {
  author: Pick<Post["author"], "name" | "username" | "accentColor">
}

/** Допис для картки: мок або feed_posts (RLS — анонім бачить лише публічне й живе). */
async function loadPost(id: string): Promise<CardPost | null> {
  if (isMockMode) return getPost(id) ?? null
  const supabase = await getSupabaseServerClient()
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await supabase.from("feed_posts").select("*").eq("id", id).maybeSingle()
  const row = data as FeedPostRow | null
  if (!row) return null
  return {
    content: row.content,
    mode: row.mode,
    expiresAt: row.expires_at,
    lights: row.light_count,
    replies: row.reply_count,
    author: { name: row.author_display_name || row.author_username, username: row.author_username, accentColor: row.author_accent_color },
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
    text: clean.length > 280 ? `${clean.slice(0, 280)}…` : clean || "Допис із вкладенням",
    accent,
    fg: accentForeground(accent),
    glow,
    permanent,
    lifeLabel: glow ? (permanent ? "назавжди" : remainingLabel(post.expiresAt, now)) : "",
    life,
    lights: formatCount(post.lights),
    replies: formatCount(post.replies),
    site: "lumyn.app",
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
          <div
            style={{
              width: story ? 96 : 72,
              height: story ? 96 : 72,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${card.accent}, #000)`,
              boxShadow: `0 0 40px ${card.accent}`,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: story ? 42 : 34, fontWeight: 600 }}>{card.name}</div>
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

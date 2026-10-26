import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import nodemailer from "nodemailer"

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const SMTP_HOST = process.env.SMTP_HOST?.trim()
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587)
const SMTP_USER = process.env.SMTP_USER?.trim()
const SMTP_PASS = process.env.SMTP_PASS?.trim()
const MAIL_FROM = process.env.MAIL_FROM?.trim() || "Lumyn <hello@lumyn.space>"

export const isDigestConfigured = Boolean(URL_BASE && SERVICE_KEY && SMTP_HOST && SMTP_USER && SMTP_PASS)

type DigestPost = { id: string; text: string; author: string; authorHandle: string; lights: number }
type DigestUser = { email: string; username: string; name: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

async function weeklyPostsFor(admin: SupabaseClient<never>, followingIds: string[]): Promise<DigestPost[]> {
  if (!followingIds.length) return []
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data } = await admin
    .from("posts")
    .select("id, content, light_count, author_id, created_at, expires_at, audience, reply_to")
    .in("author_id", followingIds.slice(0, 500))
    .gt("created_at", since)
    .eq("audience", "public")
    .is("reply_to", null)
    .order("light_count", { ascending: false })
    .limit(30)
  const rows = (data ?? []) as { id: string; content: string; light_count: number; author_id: string; expires_at: string | null }[]
  // лише живе (не згаслий Glow)
  const alive = rows.filter((r) => !r.expires_at || Date.parse(r.expires_at) > Date.now()).slice(0, 5)
  if (!alive.length) return []
  const { data: profs } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", [...new Set(alive.map((r) => r.author_id))])
  const byId = new Map(((profs ?? []) as { id: string; username: string; display_name: string }[]).map((p) => [p.id, p]))
  return alive.map((r) => {
    const p = byId.get(r.author_id)
    return {
      id: r.id,
      text: r.content.slice(0, 240),
      author: p?.display_name || p?.username || "Автор",
      authorHandle: p?.username ?? "",
      lights: r.light_count,
    }
  })
}

async function ownStats(admin: SupabaseClient<never>, me: string) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const [views, lights, followers] = await Promise.all([
    admin.from("post_views").select("post_id, viewed_at", { count: "exact", head: true }).gt("viewed_at", since),
    admin.from("lights").select("post_id, created_at", { count: "exact", head: true }).gt("created_at", since),
    admin.from("follows").select("following_id, created_at", { count: "exact", head: true }).eq("following_id", me).gt("created_at", since),
  ])
  return { views: views.count ?? 0, lights: lights.count ?? 0, followers: followers.count ?? 0 }
}

function digestHtml(user: DigestUser, posts: DigestPost[], stats: { views: number; lights: number; followers: number }) {
  const feed = posts.length
    ? posts
        .map(
          (p) => `
      <tr><td style="padding:14px 0;border-top:1px solid #eee">
        <p style="margin:0 0 4px;font-size:13px;color:#777">${esc(p.author)} · ${p.lights} світла</p>
        <p style="margin:0 0 6px;font-size:15px;line-height:1.5">${esc(p.text)}</p>
        <a href="https://lumyn.space/post/${p.id}" style="font-size:13px;color:#6c5cff">Читати в Lumyn →</a>
      </td></tr>`
        )
        .join("")
    : `<tr><td style="padding:14px 0;border-top:1px solid #eee"><p style="margin:0;font-size:15px;color:#777">Цього тижня у тих, кого ви читаєте, було тихо. Загляньте в «Огляд» — там нові люди.</p></td></tr>`
  return `<!doctype html><html lang="uk"><body style="margin:0;background:#fafafa;font-family:-apple-system,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <p style="font-size:20px;font-weight:700;margin:0 0 2px">✦ Lumyn</p>
    <p style="color:#777;font-size:13px;margin:0 0 18px">Ваш тижневий дайджест</p>
    <table style="width:100%;background:#fff;border:1px solid #eee;border-radius:12px" cellpadding="0" cellspacing="0">
      <tr><td style="padding:16px 16px 0">
        <p style="margin:0;font-size:15px">Привіт, ${esc(user.name)}! Ось що ви пропустили:</p>
      </td></tr>
      ${feed}
    </table>
    <table style="width:100%;margin-top:14px;background:#fff;border:1px solid #eee;border-radius:12px" cellpadding="0" cellspacing="0">
      <tr><td style="padding:16px">
        <p style="margin:0 0 8px;font-size:13px;color:#777">Ваші цифри за тиждень</p>
        <p style="margin:0;font-size:15px"><b>${stats.views}</b> переглядів · <b>${stats.lights}</b> світла · <b>${stats.followers}</b> нових читачів</p>
      </td></tr>
    </table>
    <p style="color:#999;font-size:12px;margin:18px 0 0;text-align:center">
      Ви отримуєте цей лист, бо маєте акаунт у Lumyn.
      <a href="https://lumyn.space/settings/privacy" style="color:#777">Налаштування</a>
    </p>
  </div></body></html>`
}

/** Тижневий дайджест: усім онбордненим користувачам з email (сервісний ключ обходить RLS). */
export async function runWeeklyDigest(): Promise<{ sent: number; skipped: number; errors: string[] }> {
  if (!isDigestConfigured) throw new Error("digest not configured")
  // без типів Database: тиснемо в службові таблиці (post_views), яких нема в типах
  const admin = createClient(URL_BASE!, SERVICE_KEY!, { auth: { persistSession: false } }) as unknown as SupabaseClient<never>
  const mail = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER!, pass: SMTP_PASS! },
  })

  // користувачі: онборднені профілі + email із auth
  const { data: profiles } = await admin.from("profiles").select("id, username, display_name").not("onboarded_at", "is", null).limit(1000)
  const profRows = (profiles ?? []) as { id: string; username: string; display_name: string }[]
  const emailById = new Map<string, string>()
  let page = 1
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    for (const u of (data?.users ?? []).slice(0, 1000)) if (u.email) emailById.set(u.id, u.email)
    if (!data || data.users.length < 1000) break
    page++
  }

  const result = { sent: 0, skipped: 0, errors: [] as string[] }
  for (const p of profRows) {
    const email = emailById.get(p.id)
    if (!email) {
      result.skipped++
      continue
    }
    try {
      const { data: follows } = await admin.from("follows").select("following_id").eq("follower_id", p.id).eq("status", "accepted").limit(500)
      const followingIds = ((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)
      const [posts, stats] = await Promise.all([weeklyPostsFor(admin, followingIds), ownStats(admin, p.id)])
      // тихо пропускаємо зовсім неактивних: нема постів і нульова активність
      if (!posts.length && stats.views + stats.lights + stats.followers === 0) {
        result.skipped++
        continue
      }
      await mail.sendMail({
        from: MAIL_FROM,
        to: email,
        subject: "Lumyn: ваш тижневий дайджест",
        html: digestHtml({ email, username: p.username, name: p.display_name || p.username }, posts, stats),
      })
      result.sent++
    } catch (e) {
      result.errors.push(`${p.username}: ${(e as Error).message}`)
    }
  }
  return result
}

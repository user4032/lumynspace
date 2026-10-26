import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/types/database"
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env"

/** Сторінки, доступні без входу (пости — лише прев'ю для гостей, RLS ховає приватне) */
const PUBLIC_PATHS = ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/login", "/auth", "/welcome", "/api", "/design", "/post", "/embed", "/terms", "/privacy", "/about", "/contact", "/guidelines"]

/** Краулери месенджерів/пошуковиків: їм віддаємо сторінку з OG-метаданими без редіректу на вхід. */
const CRAWLER_RE =
  /(telegrambot|discordbot|twitterbot|facebookexternalhit|facebot|slackbot|linkedinbot|pinterestbot|redditbot|applebot|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|semrushbot|ahrefsbot|embedly|whatsapp|skypeuripreview|vkshare|mastodon|misskey|bluesky)/i

/** Оновлює сесію Supabase на кожному запиті (рефреш токена в cookies). */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!isSupabaseConfigured) return response

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value)
        )
      },
    },
  })

  // Важливо: між createServerClient і getClaims не має бути іншого коду.
  const { data } = await supabase.auth.getClaims()

  // Без сесії — на вхід (стрічка, профілі, пости за посиланням потребують акаунта).
  // Але краулерам (Telegram/Discord/…) віддаємо сторінку, щоб працював OG-прев'ю профілю.
  const path = request.nextUrl.pathname
  const crawler = CRAWLER_RE.test(request.headers.get("user-agent") ?? "")
  if (!data?.claims?.sub && !crawler && !PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone()
    if (path === "/") {
      url.pathname = "/welcome"
      url.search = ""
    } else {
      url.pathname = "/login"
      // після входу повернутись на сторінку, з якої прийшли (напр., пост за посиланням)
      url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`
    }
    const redirect = NextResponse.redirect(url)
    // зберігаємо оновлені cookie сесії
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  return response
}

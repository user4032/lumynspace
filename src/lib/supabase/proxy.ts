import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { Database } from "@/types/database"
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env"

/** Сторінки, доступні без входу */
const PUBLIC_PATHS = ["/login", "/auth", "/welcome", "/api", "/design", "/post", "/terms", "/privacy", "/about", "/contact", "/guidelines"]

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

  // Без сесії — на вхід (стрічка, профілі, налаштування потребують акаунта).
  const path = request.nextUrl.pathname
  if (!data?.claims?.sub && !PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
  const url = request.nextUrl.clone()
  url.pathname = path === "/" ? "/welcome" : "/login"
  url.search = ""
    const redirect = NextResponse.redirect(url)
    // зберігаємо оновлені cookie сесії
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  return response
}

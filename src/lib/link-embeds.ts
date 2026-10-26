/** Розпізнавання лінків Lumyn у тексті повідомлень (для embed-карток, як у Discord). */

const PROFILE_HOSTS = new Set(["lumyn.space", "www.lumyn.space"])
const HANDLE = /^[a-z0-9_]{1,24}$/i
const URL_RE = /https?:\/\/[^\s<>"'`]+/gi

/** `https://lumyn.space/nick` → `nick`; усе інше → null. */
export function profileHandleFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (!PROFILE_HOSTS.has(url.hostname.toLowerCase())) return null
    const segments = decodeURIComponent(url.pathname).split("/").filter(Boolean)
    if (segments.length !== 1) return null
    const handle = segments[0].replace(/^@/, "").toLowerCase()
    return HANDLE.test(handle) ? handle : null
  } catch {
    return null
  }
}

/** Перше посилання на профіль у тексті (кінцева пунктуація не входить). */
export function firstProfileUrl(text: string): string | null {
  for (const raw of text.match(URL_RE) ?? []) {
    const url = raw.replace(/[.,;:!?)\]}"']+$/, "")
    if (profileHandleFromUrl(url)) return url
  }
  return null
}

export type TextPart = { text: string; href?: string }

const LINKIFY_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi

/** Текст на частини: звичайні рядки й клікабельні http(s)-посилання. */
export function linkifyText(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(LINKIFY_RE)) {
    const index = match.index ?? 0
    // кінцева пунктуація належить реченню, а не адресі
    const raw = match[0]
    const trailing = raw.match(/[.,;:!?)\]}"']+$/)?.[0] ?? ""
    const url = trailing ? raw.slice(0, -trailing.length) : raw
    if (index > last) parts.push({ text: text.slice(last, index) })
    if (url) {
      parts.push({ text: url, href: /^https?:\/\//i.test(url) ? url : `https://${url}` })
    }
    if (trailing) parts.push({ text: trailing })
    last = index + raw.length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

import { isMockMode } from "./env"

/**
 * Фіксований «зараз» для мок-даних: так SSR і клієнт рендерять однаковий час,
 * а годинник демо-світу «заморожено» на цій миті.
 */
export const MOCK_NOW = Date.parse("2026-10-08T12:00:00.000Z")

/** Поточний час: у демо — MOCK_NOW, із Supabase — реальний. Викликати лише в обробниках подій / на клієнті. */
export const getNow = () => (isMockMode ? MOCK_NOW : Date.now())
export const nowISO = () => new Date(getNow()).toISOString()

export const minutesAgo = (m: number) => new Date(MOCK_NOW - m * 60_000).toISOString()

const compact = new Intl.NumberFormat("uk-UA", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCount(n: number) {
  if (n < 1000) return String(n)
  return compact.format(n)
}

/** Українська множина: plural(5, ["допис", "дописи", "дописів"]) */
export function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

const dateFmt = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" })
const fullFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
})
const timeFmt = new Intl.DateTimeFormat("uk-UA", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
})

/** Короткий відносний час: «щойно», «5 хв», «3 год», «2 д», «12 жовт.» */
/** `now` — з useNow() (клієнт) або MOCK_NOW; без Date.now() за замовчуванням, щоб не ламати пререндер. */
export function timeAgo(iso: string, now: number) {
  const diff = Math.max(0, now - Date.parse(iso))
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "щойно"
  if (m < 60) return `${m} хв`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} год`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} д`
  return dateFmt.format(new Date(iso))
}

export function timeAgoLong(iso: string, now: number) {
  const short = timeAgo(iso, now)
  return short === "щойно" ? short : `${short} тому`
}

export const formatFullDate = (iso: string) => fullFmt.format(new Date(iso))
export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
/** «вересня 2024 р.» — родовий відмінок (формат із днем, без самого дня) */
export const formatJoined = (iso: string) =>
  new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(iso))
    .replace(/^\d+\s/, "")

/** Детермінований хеш рядка — для градієнтних аватарів */
export function hashString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

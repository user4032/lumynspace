import { cn } from "@/lib/utils"

/**
 * Іконки статусу Lumyn: сітка 24, лінія 1.75, округлі кінці. Кожна має маленьку «іскру» —
 * спільний мотив із логотипом (лише там, де доречно, без перевантаження).
 */
export const STATUS_ICONS = {
  coding: { label: "Кодю", d: ["M8.5 7 3.5 12l5 5", "M15.5 7l5 5-5 5", "M13.25 5.5 10.75 18.5"] },
  music: { label: "Слухаю музику", d: ["M9 18V6.5l10-2V16", "M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z", "M19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z", "M9 10l10-2"] },
  study: { label: "Навчаюсь", d: ["M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9Z", "M6.5 11v4.25c0 1.5 2.5 2.75 5.5 2.75s5.5-1.25 5.5-2.75V11", "M21.5 9v5"] },
  gaming: { label: "Граю", d: ["M7.5 7h9a4.5 4.5 0 0 1 4.37 5.6l-1.02 4.1a2 2 0 0 1-3.37.9L14 15h-4l-2.48 2.6a2 2 0 0 1-3.37-.9l-1.02-4.1A4.5 4.5 0 0 1 7.5 7Z", "M8 10v3", "M6.5 11.5h3", "M15.5 10.5h.01", "M17 12.5h.01"] },
  sleep: { label: "Сплю", d: ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z", "M15 4h3.5L15 8h3.5"] },
  coffee: { label: "П'ю каву", d: ["M4 10h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5Z", "M16 11h1.5a2.5 2.5 0 0 1 0 5H16", "M8 3.5c-.6.8-.6 1.7 0 2.5s.6 1.7 0 2.5", "M12 3.5c-.6.8-.6 1.7 0 2.5s.6 1.7 0 2.5"] },
  travel: { label: "Подорожую", d: ["M10.5 13.5 3 11l1.5-1.5 7.5.5 4.5-4.5a2.12 2.12 0 0 1 3 3L15 13l.5 7.5L14 22l-2.5-7.5", "M6.5 17.5 4 20", "M9 19.5 7.5 21"] },
  love: { label: "Закоханий", d: ["M12 20s-7.5-4.6-7.5-10A4.25 4.25 0 0 1 12 7.4 4.25 4.25 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z", "M19 2.5c.1 1.3 1.2 2.4 2.5 2.5-1.3.1-2.4 1.2-2.5 2.5-.1-1.3-1.2-2.4-2.5-2.5 1.3-.1 2.4-1.2 2.5-2.5Z"] },
  busy: { label: "Не турбувати", d: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M7.5 12h9"] },
  fire: { label: "У потоці", d: ["M12 21.5c-3.9 0-7-2.8-7-6.6 0-3.2 2.1-5 3.4-7 .5 1.6 1.4 2.6 2.4 3C10.4 7.6 12 4.5 14.5 2.5c.3 3.3 4.5 5.8 4.5 11.4 0 4.6-3.1 7.6-7 7.6Z", "M12 21.5a3 3 0 0 1-3-3c0-1.9 1.5-2.8 2.2-4.5.8 1.2 3.8 2.3 3.8 4.6a3 3 0 0 1-3 2.9Z"] },
} as const

export type StatusIconKey = keyof typeof STATUS_ICONS
export const STATUS_ICON_KEYS = Object.keys(STATUS_ICONS) as StatusIconKey[]
export const isStatusIconKey = (v: unknown): v is StatusIconKey => typeof v === "string" && v in STATUS_ICONS

export function StatusIcon({ icon, className }: { icon: StatusIconKey; className?: string }) {
  const def = STATUS_ICONS[icon]
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={def.label}
      role="img"
      className={cn("size-4 shrink-0", className)}
    >
      {def.d.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

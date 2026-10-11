/** Палітра акцентів профілю. Перший — фірмовий колір Lumyn. */
export const ACCENTS: { name: string; value: string }[] = [
  { name: "Електрик", value: "#3b8eff" },
  { name: "Фіолет", value: "#8b5cf6" },
  { name: "Фуксія", value: "#ff3d81" },
  { name: "Корал", value: "#ff6b4a" },
  { name: "Сонце", value: "#ffb224" },
  { name: "Лайм", value: "#a3e635" },
  { name: "М'ята", value: "#2dd4bf" },
  { name: "Лід", value: "#7dd3fc" },
]

export const DEFAULT_ACCENT = ACCENTS[0].value

export function isHexColor(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v)
}

/** Текст поверх акценту: чорний для світлих кольорів, білий для темних. */
export function accentForeground(hex: string) {
  if (!isHexColor(hex)) return "#ffffff"
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.33 ? "#0a0a0a" : "#ffffff"
}

/** CSS-змінні акценту для обгортки (профіль, картка, прев'ю). */
export function accentVars(hex: string | undefined | null): React.CSSProperties {
  const c = hex && isHexColor(hex) ? hex : DEFAULT_ACCENT
  return { "--accent-user": c, "--accent-user-fg": accentForeground(c) } as React.CSSProperties
}

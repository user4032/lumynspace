/**
 * OAuth-аватари Google за замовчуванням приходять як `=s96-c` (96×96).
 * На профілі вони масштабуються до ~108 CSS px, тому виглядають піксельно.
 * Просимо в Google версію 512×512 — вона різка на всіх розмірах і кешується.
 */
export function hiResAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === "lh3.googleusercontent.com" || host.endsWith(".googleusercontent.com")) {
      return url.replace(/=(?:s\d+(?:-c)?|w\d+-h\d+)(?:-[a-z0-9]+)*(?=$|[?&#])/i, "=s512-c")
    }
  } catch {
    // не URL — лишаємо як є (наприклад, мок-дані)
  }
  return url
}

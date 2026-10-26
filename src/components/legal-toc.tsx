"use client"

import { useEffect, useState } from "react"
import { Link2, List } from "lucide-react"
import { cn } from "@/lib/utils"

type Item = { id: string; text: string }

/** Заголовок → читабельний якір (#повага-до-людей) */
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 48) || "section"

/**
 * Зміст юридичних сторінок: сам знаходить h2 у [data-legal-content],
 * роздає їм id і якорі, підсвічує активний розділ при скролі.
 */
export function LegalToc() {
  const [items, setItems] = useState<Item[]>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    let observer: IntersectionObserver | null = null
    // після фарбу: h2 уже в DOM, розміри стабільні
    const raf = requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>("[data-legal-content]")
      if (!root) return
      const seen = new Set<string>()
      const heads = [...root.querySelectorAll("h2")]
      const list: Item[] = []
      for (const h of heads) {
        let id = slug(h.textContent ?? "")
        while (seen.has(id)) id = `${id}-2`
        seen.add(id)
        h.id = id
        list.push({ id, text: h.textContent ?? "" })
      }
      setItems(list)

      // «#»-посилання на розділ при ховері (як у GitHub)
      for (const h of heads) {
        if (h.querySelector("[data-toc-link]")) continue
        const a = document.createElement("a")
        a.href = `#${h.id}`
        a.dataset.tocLink = ""
        a.setAttribute("aria-label", "Посилання на розділ")
        a.className =
          "ml-2 inline-flex align-middle text-transparent transition-colors group-hover:text-muted-foreground hover:text-foreground!"
        a.textContent = "#"
        h.appendChild(a)
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) setActive(e.target.id)
          }
        },
        { rootMargin: "-96px 0px -70% 0px" }
      )
      heads.forEach((h) => observer?.observe(h))
    })
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [])

  if (items.length < 2) return null

  return (
    <>
      {/* мобільний випадаючий зміст */}
      <details className="mb-8 rounded-xl border bg-subtle/50 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
          <List className="size-4 text-muted-foreground" /> Зміст
        </summary>
        <ol className="space-y-1 border-t px-4 py-3">
          {items.map((it, i) => (
            <li key={it.id}>
              <a href={`#${it.id}`} className="flex gap-2 py-1 text-sm text-muted-foreground hover:text-foreground">
                <span className="font-mono text-xs tabular opacity-60">{String(i + 1).padStart(2, "0")}</span>
                {it.text}
              </a>
            </li>
          ))}
        </ol>
      </details>

      {/* десктопний sticky зміст */}
      <nav aria-label="Зміст" className="sticky top-24 hidden self-start lg:block">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Link2 className="size-3.5" /> Зміст
        </p>
        <ol className="mt-3 space-y-0.5 border-l">
          {items.map((it, i) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className={cn(
                  "-ml-px block border-l-2 py-1.5 pl-3 text-[13px] leading-snug transition-colors",
                  active === it.id
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <span className="mr-1.5 font-mono text-[11px] tabular opacity-50">{String(i + 1).padStart(2, "0")}</span>
                {it.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}

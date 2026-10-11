"use client"

import { useMemo, useState } from "react"
import { highlight } from "sugar-high"
import { Check, Copy } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import type { CodeMedia } from "@/types"
import { cn } from "@/lib/utils"

const LANG_LABEL: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TSX",
  js: "JavaScript",
  jsx: "JSX",
  sql: "SQL",
  rust: "Rust",
  py: "Python",
  css: "CSS",
  bash: "Bash",
}

export function CodeBlock({ media, className }: { media: CodeMedia; className?: string }) {
  const [copied, setCopied] = useState(false)
  const html = useMemo(() => highlight(media.code), [media.code])

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard?.writeText(media.code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className={cn("code-block overflow-hidden rounded-lg border bg-subtle", className)}>
      <div className="flex h-9 items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="size-2 rounded-full bg-foreground/15" />
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {media.filename ?? LANG_LABEL[media.lang] ?? media.lang}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[11px] text-muted-foreground/70 uppercase sm:inline">{media.lang}</span>
          <button
            type="button"
            onClick={copy}
            aria-label="Скопіювати код"
            className="relative inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={copied ? "ok" : "copy"}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12 }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto px-3 py-3 font-mono text-[12.5px] leading-[1.7] no-scrollbar">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}

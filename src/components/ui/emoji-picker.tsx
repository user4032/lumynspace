"use client"

import { useState } from "react"
import { Smile } from "lucide-react"
import { cn } from "@/lib/utils"

const EMOJIS = [
  "😀","😂","🥹","😍","🤩","😎","🤔","😅","😭","😡",
  "👍","👎","👏","🙌","🤝","✌️","🤞","💪","🔥","✨",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💯",
  "🎉","🎊","🚀","⭐","🌟","💥","⚡","🌈","☀️","🌙",
]

export function EmojiPicker({
  onPick,
  className,
}: {
  onPick: (emoji: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Емодзі"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
          className
        )}
      >
        <Smile className="size-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-xl border bg-popover p-2 shadow-lg">
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-muted"
                  onClick={() => {
                    onPick(e)
                    setOpen(false)
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
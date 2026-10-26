"use client"

import { useState } from "react"
import { Smile } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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

  // Popover рендериться в портал: не обрізається overflow-hidden композера й не ховається під фото
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Емодзі"
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
            className
          )}
        >
          <Smile className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} collisionPadding={8} className="z-[60] w-auto p-2">
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
      </PopoverContent>
    </Popover>
  )
}

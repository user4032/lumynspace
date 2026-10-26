"use client"
import { useState } from "react"
import { Smile } from "lucide-react"

const EMOJIS = ["😀","😂","🥹","😍","🤩","😎","🤔","😴","😭","😡","👍","👎","❤️","🔥","✨","💯","🎉","🚀","👀","💀"]

export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="rounded-full p-1.5 hover:bg-muted">
        <Smile className="size-5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 grid w-48 grid-cols-5 gap-1 rounded-xl border bg-popover p-2 shadow-lg">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => { onPick(e); setOpen(false) }} className="rounded p-1 text-lg hover:bg-muted">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
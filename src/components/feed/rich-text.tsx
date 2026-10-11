import Link from "next/link"
import { Fragment } from "react"

const TOKEN = /(#[\p{L}\p{N}_]+|@[a-z0-9_.]{3,24}|https?:\/\/[^\s]+)/giu

/** Підсвічує #хештеги, @згадки й посилання в тексті допису */
export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN)
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        if (part.startsWith("#") && part.length > 1)
          return (
            <Link key={i} href={`/explore?q=${encodeURIComponent(part)}`} className="text-brand hover:underline">
              {part}
            </Link>
          )
        if (part.startsWith("@") && part.length > 3)
          return (
            <Link key={i} href={`/${part.slice(1)}`} className="text-brand hover:underline">
              {part}
            </Link>
          )
        if (/^https?:\/\//.test(part))
          return (
            <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
              {part.replace(/^https?:\/\//, "")}
            </a>
          )
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

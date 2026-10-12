"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <span className="text-6xl">✦</span>
      <h1 className="mt-4 text-2xl font-semibold">Щось пішло не так</h1>
      <p className="mt-2 text-sm text-muted-foreground">Спробуйте оновити сторінку або поверніться пізніше.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-full border px-4 py-2 text-sm">
          Спробувати знову
        </button>
        <Link href="/" className="rounded-full bg-foreground px-4 py-2 text-sm text-background">
          На головну
        </Link>
      </div>
    </div>
  )
}
import Link from "next/link"
import { LogoMark } from "@/components/logo"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-radial opacity-50" />
      <LogoMark className="relative size-8" />
      <p className="relative mt-6 font-mono text-sm text-muted-foreground">404</p>
      <h1 className="relative mt-2 text-3xl font-semibold tracking-[-0.04em]">Сторінку не знайдено</h1>
      <p className="relative mt-2 max-w-sm text-muted-foreground">Можливо, її видалили або посилання містить помилку.</p>
      <Button asChild className="relative mt-6">
        <Link href="/">На головну</Link>
      </Button>
    </div>
  )
}

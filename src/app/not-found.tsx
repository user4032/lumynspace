import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <span className="text-6xl">✦</span>
      <h1 className="mt-4 text-2xl font-semibold">Сторінку не знайдено</h1>
      <p className="mt-2 text-sm text-muted-foreground">Можливо, її видалили або посилання містить помилку.</p>
      <Link href="/" className="mt-6 rounded-full bg-foreground px-4 py-2 text-sm text-background">
        На головну
      </Link>
    </div>
  )
}
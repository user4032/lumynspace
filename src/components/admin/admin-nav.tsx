import Link from "next/link"

export function AdminNav({ active }: { active: "reports" | "users" | "accessories" }) {
  const cls = (on: boolean) =>
    `rounded-full px-3 py-1 text-sm ${on ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`
  return (
    <nav className="mb-6 flex gap-2">
      <Link href="/admin/reports" className={cls(active === "reports")}>Скарги</Link>
      <Link href="/admin/users" className={cls(active === "users")}>Користувачі</Link>
      <Link href="/admin/accessories" className={cls(active === "accessories")}>Рамки</Link>
    </nav>
  )
}

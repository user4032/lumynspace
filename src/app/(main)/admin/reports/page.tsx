import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { AdminNav } from "@/components/admin/admin-nav"
import { ReportActions } from "@/components/admin/report-actions"

export const metadata: Metadata = { title: "Адмін · Скарги" }

type Report = {
  id: string
  target_type: string
  target_id: string
  reason: string
  details: string
  created_at: string
  reporter_username: string | null
  target_user: string | null
  target_username: string | null
  target_preview: string
}

const REASONS: Record<string, string> = {
  spam: "Спам", harassment: "Цькування", hate: "Ненависть", violence: "Насильство", nudity: "Оголеність",
  self_harm: "Самошкодження", impersonation: "Видає себе за іншого", minor_safety: "Безпека дітей", other: "Інше",
}

export default function AdminReportsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav active="reports" />
      <h1 className="text-2xl font-semibold">Скарги</h1>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Завантаження…</p>}>
        <ReportsList />
      </Suspense>
    </div>
  )
}

async function ReportsList() {
  const { rpc } = await requireAdmin()
  const { data, error } = await rpc("admin_open_reports", { p_limit: 200 })
  const reports = (data ?? []) as Report[]

  return (
    <>
      <p className="mt-1 text-sm text-muted-foreground">{reports.length} відкритих</p>
      {error && <p className="mt-4 text-sm text-destructive">{error.message}</p>}
      <ul className="mt-6 divide-y">
        {reports.map((r) => (
          <li key={r.id} className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {r.target_type === "post" ? "Допис" : r.target_type === "profile" ? "Профіль" : r.target_type} · {REASONS[r.reason] ?? r.reason}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("uk")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Від {r.reporter_username ? `@${r.reporter_username}` : "—"}
              {r.target_username && (
                <>
                  {" · на "}
                  <Link href={`/${r.target_username}`} className="underline">@{r.target_username}</Link>
                </>
              )}
            </p>
            {r.details && <p className="text-sm">{r.details}</p>}
            {r.target_preview && <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">{r.target_preview}</blockquote>}
            <div className="flex flex-wrap items-center gap-3">
              {r.target_type === "post" && (
                <Link href={`/post/${r.target_id}`} className="text-xs underline">Відкрити допис</Link>
              )}
              {r.target_username && (
                <Link href={`/admin/users?q=${encodeURIComponent(r.target_username)}`} className="text-xs underline">
                  Дії з користувачем
                </Link>
              )}
            </div>
            <ReportActions reportId={r.id} postId={r.target_type === "post" ? r.target_id : null} />
          </li>
        ))}
      </ul>
    </>
  )
}

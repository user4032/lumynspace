import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import Link from "next/link"
import { revalidatePath } from "next/cache"

export const instant = false

async function dismissReport(id: string) {
  "use server"
  const supabase = await getSupabaseServerClient()
  if (!supabase) return
  await supabase.from("reports").update({ status: "dismissed" }).eq("id", id)
  revalidatePath("/admin/reports")
}

async function deletePost(postId: string, reportId: string) {
  "use server"
  const supabase = await getSupabaseServerClient()
  if (!supabase) return
  await supabase.from("posts").delete().eq("id", postId)
  await supabase.from("reports").update({ status: "resolved" }).eq("id", reportId)
  revalidatePath("/admin/reports")
}

export default async function AdminReportsPage() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) redirect("/login")

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: me } = await supabase.from("profiles").select("is_admin" as "*").eq("id", user.id).single()
  if (!(me as { is_admin?: boolean })?.is_admin) redirect("/")

  const { data: reports } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, details, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Скарги</h1>
      <p className="mt-1 text-sm text-muted-foreground">{reports?.length ?? 0} відкритих</p>

      <ul className="mt-6 divide-y">
        {reports?.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.target_type} · {r.reason}</span>
              <span className="text-xs text-muted-foreground">{r.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.target_id.slice(0, 8)}… · {new Date(r.created_at).toLocaleString("uk")}
            </p>
            <div className="mt-3 flex gap-2">
              {r.target_type === "post" && (
                <Link href={`/post/${r.target_id}`} className="text-xs underline">Відкрити</Link>
              )}
              <form action={dismissReport.bind(null, r.id)}>
                <button type="submit" className="text-xs text-muted-foreground underline">Відхилити</button>
              </form>
              {r.target_type === "post" && (
                <form action={deletePost.bind(null, r.target_id, r.id)}>
                  <button type="submit" className="text-xs text-destructive underline">Видалити пост</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
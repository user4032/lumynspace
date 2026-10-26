import "server-only"
import { redirect } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"

type Rpc = (fn: string, args?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>

/** Сервер: пускає лише адмінів (RPC is_admin). Повертає клієнт і rpc-хелпер. */
export async function requireAdmin() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) redirect("/login")
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect("/login")
  const rpc = supabase.rpc as unknown as Rpc
  const { data: ok } = await rpc.call(supabase, "is_admin")
  if (ok !== true) redirect("/")
  return { supabase, rpc: (fn: string, args?: object) => rpc.call(supabase, fn, args) }
}

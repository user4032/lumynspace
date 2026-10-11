import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // усе, крім статики, картинок і OG-роутів
    "/((?!_next/static|_next/image|favicon.ico|mock/|api/og|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

import { NextResponse } from "next/server"
import { getBookmarkedPosts } from "@/lib/queries"

export async function GET() {
  const posts = await getBookmarkedPosts()
  return NextResponse.json({ posts })
}

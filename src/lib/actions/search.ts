"use server"

import { searchAll } from "@/lib/queries"
import { isMockMode } from "@/lib/env"

/** Пошук для командної палітри (⌘K): люди, спільноти, дописи. */
export async function quickSearch(query: string) {
  if (isMockMode || query.trim().length < 2) return { people: [], communities: [], posts: [] }
  const res = await searchAll(query, { people: 5, communities: 4, posts: 5 })
  // лише те, що потрібно палітрі
  return {
    people: res.people.map((u) => ({ id: u.id, username: u.username, name: u.name, avatarUrl: u.avatarUrl ?? null })),
    communities: res.communities.map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
    posts: res.posts.map((p) => ({ id: p.id, author: p.author.username, content: p.content.slice(0, 80) })),
  }
}

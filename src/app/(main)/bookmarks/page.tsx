" use client\

import { useEffect, useState, useTransition } from \react\
import Link from \next/link\
import { Bookmark, Folder, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from \lucide-react\
import { toast } from \sonner\
import { PageHeader } from \@/components/layout/page-header\
import { PostCard, PostSkeleton } from \@/components/feed/post-card\
import { Button } from \@/components/ui/button\
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from \@/components/ui/dropdown-menu\
import { Input } from \@/components/ui/input\
import { isMockMode } from \@/lib/env\
import { useViewer } from \@/lib/viewer-store\
import type { Post } from \@/types\
import {
 createBookmarkCollection,
 deleteBookmarkCollection,
 listBookmarkCollections,
 renameBookmarkCollection,
 type BookmarkCollection,
} from \@/lib/actions/bookmarks\
import { cn } from \@/lib/utils\

export default function BookmarksPage() {
 const bookmarks = useViewer((s) => s.bookmarks)
 const [collections, setCollections] = useState<BookmarkCollection[]>([])
 const [active, setActive] = useState<string | null>(null)
 const [posts, setPosts] = useState<Post[] | null>(null)
 const [loading, setLoading] = useState(true)
 const [creating, setCreating] = useState(false)
 const [newName, setNewName] = useState(\\)
 const [renaming, setRenaming] = useState<string | null>(null)
 const [renameName, setRenameName] = useState(\\)
 const [pending, startTransition] = useTransition()

 useEffect(() => {
 if (isMockMode) return
 void listBookmarkCollections().then((res) => {
 if (res.ok && res.data) setCollections(res.data)
 })
 }, [])

 useEffect(() => {
 setLoading(true)
 fetch(\/api/bookmarks\)
 .then((r) => r.json())
 .then((data) => {
 setPosts(data.posts || [])
 setLoading(false)
 })
 .catch(() => {
 setPosts([])
 setLoading(false)
 })
 }, [bookmarks.join(",\)])

  const create = () => {
    if (!newName.trim()) return
    startTransition(async () => {
      const res = await createBookmarkCollection(newName)
      if (res.ok && res.data) {
        setCollections((prev) => [...prev, res.data!].sort((a, b) => a.created_at.localeCompare(b.created_at)))
        setNewName(\\)
        setCreating(false)
        toast.success(\Папку створено\)
      } else if (!res.ok) toast.error(res.error)
    })
  }

  const rename = (id: string) => {
    if (!renameName.trim()) return
    startTransition(async () => {
      const res = await renameBookmarkCollection(id, renameName)
      if (res.ok) {
        setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name: renameName.trim() } : c)))
        setRenaming(null)
        setRenameName(\\)
        toast.success(\Папку перейменовано\)
      } else if (!res.ok) toast.error(res.error)
    })
  }

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteBookmarkCollection(id)
      if (res.ok) {
        setCollections((prev) => prev.filter((c) => c.id !== id))
        if (active === id) setActive(null)
        toast(\Папку видалено\)
      } else if (!res.ok) toast.error(res.error)
    })
  }

  const filtered = posts && active ? posts.filter((p: any) => p.bookmarkCollectionId === active) : posts

  return (
    <>
      <PageHeader title=\Збережені\ subtitle=\Тільки для вас — ніхто інший не бачить цього списку\ />

      <div className=\grid gap-0 md:grid-cols-[240px_1fr]\>
        <aside className=\border-r\>
          <div className=\flex items-center justify-between px-4 py-3\>
            <p className=\text-sm font-semibold\>Папки</p>
            {!isMockMode && (
              <Button variant=\ghost\ size=\sm\ className=\h-7 rounded-full px-2\ onClick={() => setCreating(true)}>
                <Plus className=\size-4\ />
              </Button>
            )}
          </div>
          <nav className=\px-2 pb-3\>
            <button
              onClick={() => setActive(null)}
              className={cn(
                \flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm\,
                active === null ? \bg-muted font-medium\ : \text-muted-foreground hover:bg-subtle hover:text-foreground\
              )}
            >
              <Bookmark className=\size-4\ />
              Усі
            </button>
            {collections.map((c) => (
              <div key={c.id} className=\group flex items-center gap-1\>
                <button
                  onClick={() => setActive(c.id)}
                  className={cn(
                    \flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm\,
                    active === c.id ? \bg-muted font-medium\ : \text-muted-foreground hover:bg-subtle hover:text-foreground\
                  )}
                >
                  <Folder className=\size-4\ />
                  <span className=\truncate\>{c.name}</span>
                </button>
                {!isMockMode && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant=\ghost\ size=\sm\ className=\h-7 w-7 rounded-full p-0 opacity-0 group-hover:opacity-100\>
                        <MoreHorizontal className=\size-4\ />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align=\end\>
                      <DropdownMenuItem onSelect={() => { setRenaming(c.id); setRenameName(c.name) }}>
                        <Pencil className=\size-4\ /> Перейменувати
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className=\text-destructive\ onSelect={() => remove(c.id)}>
                        <Trash2 className=\size-4\ /> Видалити
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
            {creating && (
              <div className=\mt-1 flex items-center gap-1 px-1\>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === \Enter\ && create()}
                  placeholder=\Назва папки\
                  className=\h-8 text-sm\
                  autoFocus
                />
                <Button size=\sm\ className=\h-8 rounded-full\ disabled={pending} onClick={create}>
                  <FolderPlus className=\size-4\ />
                </Button>
              </div>
            )}
            {renaming && (
              <div className=\mt-1 flex items-center gap-1 px-1\>
                <Input
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onKeyDown={(e) => e.key === \Enter\ && rename(renaming)}
                  className=\h-8 text-sm\
                  autoFocus
                />
                <Button size=\sm\ className=\h-8 rounded-full\ disabled={pending} onClick={() => rename(renaming)}>
                  Зберегти
                </Button>
              </div>
            )}
          </nav>
        </aside>

        <div>
          {loading ? (
            <PostSkeleton media />
          ) : !filtered || filtered.length === 0 ? (
            <div className=\flex flex-col items-center gap-3 px-6 py-24 text-center\>
              <span className=\grid size-14 place-items-center rounded-2xl border bg-subtle\>
                <Bookmark className=\size-6 text-muted-foreground\ />
              </span>
              <p className=\text-sm font-medium\>Тут поки порожньо</p>
              <p className=\max-w-64 text-sm text-muted-foreground\>
                Тицьніть іконку закладки під дописом — і він зберігся тут
              </p>
              <Link href=\/\ className=\mt-2 text-sm font-medium text-foreground underline underline-offset-4\>
                До стрічки
              </Link>
            </div>
          ) : (
            <>
              {filtered.map((p: Post, i: number) => (
                <PostCard key={p.id} post={p} index={i} stagger />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}

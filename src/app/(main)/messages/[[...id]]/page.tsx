import type { Metadata } from "next"
import { Suspense } from "react"
import { MessageSquare } from "lucide-react"
import { ConversationList } from "@/components/chat/conversation-list"
import { ChatThread } from "@/components/chat/chat-thread"
import { Button } from "@/components/ui/button"
import { conversations as mockConversations, currentUser, getConversation, getUserByUsername } from "@/lib/mock-data"
import { isMockMode } from "@/lib/env"
import { getConversationThread, listConversations } from "@/lib/queries"
import type { Conversation } from "@/types"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Повідомлення" }

function EmptyState({ empty = false }: { empty?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full border bg-subtle">
        <MessageSquare className="size-5 text-muted-foreground" />
      </span>
      <div>
        <p className="font-semibold">{empty ? "Поки немає розмов" : "Оберіть розмову"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {empty ? "Відкрийте профіль людини й натисніть «Написати», щоб почати листування." : "Або почніть нову — повідомлення доставляються миттєво."}
        </p>
      </div>
      {isMockMode && <Button size="sm" className="mt-1 rounded-full">Нове повідомлення</Button>}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="flex h-full flex-col" aria-hidden>
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <div className="shimmer size-9 rounded-full" />
        <div className="shimmer h-4 w-32 rounded" />
      </div>
      <div className="flex-1 space-y-3 p-6">
        <div className="shimmer h-9 w-1/2 rounded-2xl" />
        <div className="shimmer ml-auto h-9 w-1/3 rounded-2xl" />
        <div className="shimmer h-9 w-2/5 rounded-2xl" />
      </div>
    </div>
  )
}

async function Thread({ params }: { params: PageProps<"/messages/[[...id]]">["params"] }) {
  const { id } = await params
  const key = id?.[0] ? decodeURIComponent(id[0]) : undefined
  let conversations: Conversation[]
  let conversation: Conversation | null | undefined
  let meId: string

  if (!isMockMode) {
    const live = await listConversations()
    conversations = live.conversations
    meId = live.meId ?? ""
    conversation = key ? await getConversationThread(key, conversations) : undefined
  } else {
    conversations = mockConversations
    meId = currentUser.id
    conversation = key ? getConversation(key) : undefined
    if (key && !conversation) {
      const user = getUserByUsername(key)
      if (user) conversation = { id: user.username, user, messages: [], unread: 0 }
    }
  }
  return (
    <div className="grid h-full lg:grid-cols-[320px_1fr]">
      <div className={cn("h-full min-h-0 border-r", conversation ? "hidden lg:block" : "block")}>
        <ConversationList conversations={conversations} activeId={conversation?.id} meId={meId} />
      </div>
      <div className={cn("h-full min-h-0", conversation ? "block" : "hidden lg:block")}>
        {conversation ? <ChatThread key={conversation.id} conversation={conversation} /> : <EmptyState empty={conversations.length === 0} />}
      </div>
    </div>
  )
}

export default function MessagesPage({ params }: PageProps<"/messages/[[...id]]">) {
  return (
    <div data-layout="wide" className="h-[calc(100dvh-3.5rem-4rem)] md:h-[calc(100dvh-3.5rem)]">
      <Suspense fallback={<Skeleton />}>
        <Thread params={params} />
      </Suspense>
    </div>
  )
}

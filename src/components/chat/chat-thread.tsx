"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUp,
  Info,
  Paperclip,
  Phone,
  Smile,
} from "lucide-react";
import type { Conversation, Message } from "@/types";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { markConversationRead, sendMessage, startDirectConversation } from "@/lib/actions/social";
import { useRealtime, useTypingChannel } from "@/hooks/useRealtime";
import { currentUser } from "@/lib/mock-data";
import { formatTime, nowISO } from "@/lib/format";
import { isMockMode } from "@/lib/env";
import { useMe, useViewer } from "@/lib/viewer-store";
import { useModeration } from "@/components/moderation/use-moderation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MOCK_REPLIES = [
  "Ага, бачу 👀",
  "Класно виходить! Покажеш ще мобільну версію?",
  "Супер, дякую 🙌",
  "Давай завтра созвонимось і все обговоримо",
];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-blink rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export function ChatThread({ conversation }: { conversation: Conversation }) {
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const replyIdx = useRef(0);
  const blocked = useViewer((s) => s.blocked.includes(conversation.user.id));
  const { block } = useModeration();
  const router = useRouter();
  const me = useMe();
  const meId = isMockMode ? currentUser.id : me.id;
  // Supabase: розмова без id (відкрито за ніком) створюється з першим повідомленням
  const [convId, setConvId] = useState(conversation.id);
  const isSaved = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(convId);

  useEffect(() => {
    if (!isMockMode && isSaved && conversation.unread > 0) void markConversationRead(convId);
  }, [convId, isSaved, conversation.unread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  // Реальні нові повідомлення (коли підключено Supabase)
  useRealtime<{
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
  }>({
    table: "messages",
    filter: `conversation_id=eq.${convId}`,
    enabled: !isMockMode && isSaved,
    onInsert: (row) => {
      const incoming: Message = {
        id: row.id,
        senderId: row.sender_id,
        content: row.content,
        createdAt: row.created_at,
      };
      setMessages((m) => {
        if (m.some((x) => x.id === row.id)) return m;
        // моє ж повідомлення, яке ще висить як оптимістичне local-…
        const localIdx = m.findIndex((x) => x.id.startsWith("local-") && x.senderId === row.sender_id && x.content === row.content);
        if (localIdx >= 0) return m.map((x, i) => (i === localIdx ? incoming : x));
        return [...m, incoming];
      });
      if (row.sender_id !== meId) {
        setTyping(false);
        void markConversationRead(convId);
      }
    },
  });

  // «друкує…» через Realtime Broadcast (лише для збереженої розмови)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const notifyTyping = useTypingChannel(isSaved && !isMockMode ? convId : "", meId, () => {
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  });
  const onType = (value: string) => {
    setText(value);
    if (isMockMode || !isSaved || !value) return;
    const t = performance.now();
    if (t - lastTypingSent.current > 2000) {
      lastTypingSent.current = t;
      notifyTyping();
    }
  };

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setText("");
    const mine: Message = {
      id: `local-${crypto.randomUUID()}`,
      senderId: meId,
      content,
      createdAt: nowISO(),
    };
    setMessages((m) => [...m, mine]);
    let target = convId;
    if (!isMockMode && !isSaved) {
      const started = await startDirectConversation(conversation.user.id);
      if (!started.ok || !started.data) {
        setMessages((m) => m.filter((x) => x.id !== mine.id));
        toast.error(started.ok ? "Не вдалося почати розмову" : started.error);
        return;
      }
      target = started.data;
      setConvId(target);
    }
    const res = await sendMessage(target, content);
    if (!res.ok) {
      setMessages((m) => m.filter((x) => x.id !== mine.id));
      toast.error(res.error);
      return;
    }
    // справжній id (якщо Realtime ще не підмінив оптимістичне повідомлення)
    const savedId = res.data;
    if (savedId)
      setMessages((m) =>
        m.some((x) => x.id === savedId) ? m.filter((x) => x.id !== mine.id) : m.map((x) => (x.id === mine.id ? { ...x, id: savedId } : x)),
      );
    // нова розмова → справжня адреса /messages/<id> і оновлений список ліворуч
    if (target !== conversation.id) router.replace(`/messages/${target}`);

    if (res.ok && res.mock) {
      // Демо: співрозмовник «друкує…» і відповідає
      setTimeout(() => setTyping(true), 700);
      setTimeout(() => {
        setTyping(false);
        const reply = MOCK_REPLIES[replyIdx.current++ % MOCK_REPLIES.length];
        setMessages((m) => [
          ...m,
          {
            id: `local-${crypto.randomUUID()}`,
            senderId: conversation.user.id,
            content: reply,
            createdAt: nowISO(),
          },
        ]);
      }, 2300);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          asChild
          className="rounded-full lg:hidden"
        >
          <Link href="/messages" aria-label="До розмов">
            <ArrowLeft />
          </Link>
        </Button>
        <Link
          href={`/${conversation.user.username}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <UserAvatar user={conversation.user} size="md" showOnline />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {conversation.user.name}
            </p>
            <p className="h-4 text-xs text-muted-foreground">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={typing ? "typing" : "status"}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.15 }}
                  className={cn("block", typing && "text-brand")}
                >
                  {typing
                    ? "друкує…"
                    : conversation.user.online
                      ? "у мережі"
                      : `@${conversation.user.username}`}
                </motion.span>
              </AnimatePresence>
            </p>
          </div>
        </Link>
        <Button variant="ghost" size="icon-sm" aria-label="Дзвінок">
          <Phone />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Інформація">
          <Info />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-1">
          <div className="my-3 flex items-center gap-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" /> Сьогодні{" "}
            <span className="h-px flex-1 bg-border" />
          </div>
          {messages.map((m, i) => {
            const mine = m.senderId === meId;
            const prev = messages[i - 1];
            const grouped = prev?.senderId === m.senderId;
            return (
              <motion.div
                key={m.id}
                layout="position"
                initial={
                  m.id.startsWith("local-")
                    ? { opacity: 0, y: 8, scale: 0.98 }
                    : false
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                  "flex",
                  mine ? "justify-end" : "justify-start",
                  !grouped && i > 0 && "mt-2.5",
                )}
              >
                <div
                  className={cn(
                    "group/msg relative max-w-[78%] rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "border bg-subtle",
                    mine && grouped && "rounded-tr-md",
                    !mine && grouped && "rounded-tl-md",
                  )}
                >
                  {m.content}
                  <span
                    className={cn(
                      "ml-2 inline-block translate-y-0.5 font-mono text-[10px]",
                      mine
                        ? "text-primary-foreground/55"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatTime(m.createdAt)}
                  </span>
                </div>
              </motion.div>
            );
          })}
          <AnimatePresence>
            {typing && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2.5 flex"
              >
                <div className="rounded-2xl border bg-subtle px-3.5 py-3">
                  <TypingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {blocked ? (
        <div className="shrink-0 border-t p-4 text-center text-sm text-muted-foreground">
          Ви заблокували @{conversation.user.username}. Писати одне одному не
          можна.{" "}
          <button
            onClick={() => block(conversation.user, false)}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Розблокувати
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="shrink-0 border-t p-3"
        >
          <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border bg-subtle p-1.5 pl-2 transition-colors focus-within:border-ring">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Прикріпити"
              className="rounded-lg"
            >
              <Paperclip />
            </Button>
            <textarea
              value={text}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Повідомлення…"
              aria-label="Повідомлення"
              className="field-sizing-content max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Емодзі"
              className="rounded-lg"
            >
              <Smile />
            </Button>
            <Button
              type="submit"
              size="icon-sm"
              disabled={!text.trim()}
              aria-label="Надіслати"
              className="rounded-lg"
            >
              <ArrowUp />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

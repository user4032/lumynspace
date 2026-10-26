"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { uploadChatFile, useSignedUrls, formatBytes } from "@/lib/chat-files"
import { formatVoice, messageSummary } from "./message-body"
import { MessageBody } from "./message-body"
import { StorySnapshotViewer } from "./story-reply"
import { StoryViewer } from "@/components/stories/story-viewer"
import { ChatInfoPanel } from "./chat-info-panel"
import { EmojiPicker } from "@/components/ui/emoji-picker"
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  CornerUpLeft,
  FileText,
  Info,
  Mic,
  Paperclip,
  Pencil,
  SmilePlus,
  Trash2,
  Users2,
  X,
} from "lucide-react";
import type { ChatAttachment, ChatStorySnapshot, Conversation, Message, StoryGroup } from "@/types";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { deleteMessage, editMessage, markConversationRead, reactMessage, sendMessage, startDirectConversation } from "@/lib/actions/social";
import { getStoryThread } from "@/lib/actions/stories";
import type { MessageReaction } from "@/types";
import { useRealtime, useTypingChannel } from "@/hooks/useRealtime";
import { currentUser } from "@/lib/mock-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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

const REACTIONS = ["👍", "❤️", "😂", "🔥", "😢", "🎉"] as const;

export function ChatThread({ conversation }: { conversation: Conversation }) {
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false)
  const [pending, setPending] = useState<ChatAttachment[]>([])
  // 0014: реакції та відповіді на повідомлення
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({})
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  // 0021: редагування й видалення повідомлень
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  // прев'ю історії у відповіді: спершу показуємо знімок, потім — живе сторіс (якщо ще не зникло)
  const [storyPeek, setStoryPeek] = useState<{
    story: ChatStorySnapshot
    group: StoryGroup | null
    loading: boolean
    unavailable: boolean
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
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
    edited_at?: string | null;
    attachments?: ChatAttachment[];
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
        editedAt: row.edited_at ?? null,
        attachments: row.attachments ?? [],
      };
      setMessages((m) => {
        if (m.some((x) => x.id === row.id)) return m;
        // моє ж повідомлення, яке ще висить як оптимістичне local-…
        const localIdx = m.findIndex((x) => x.id.startsWith("local-") && x.senderId === row.sender_id && x.content === row.content && (x.attachments?.length ?? 0) === (row.attachments?.length ?? 0));
        if (localIdx >= 0) return m.map((x, i) => (i === localIdx ? incoming : x));
        return [...m, incoming];
      });
      if (row.sender_id !== meId) {
        setTyping(false);
        void markConversationRead(convId);
      }
    },
    // 0021: чуже редагування/видалення підхоплюємо без перезавантаження
    onUpdate: (row) => {
      setMessages((list) =>
        list.map((m) =>
          m.id === row.id
            ? { ...m, content: row.content, editedAt: row.edited_at ?? null }
            : m,
        ),
      );
    },
    onDelete: (old) => {
      if (!old.id) return;
      setMessages((list) => list.filter((m) => m.id !== old.id));
      setReactions((map) => {
        if (!(old.id! in map)) return map;
        const next = { ...map };
        delete next[old.id!];
        return next;
      });
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
  /** Розмова має існувати в БД, щоб вкладення лягли в її приватну теку */
  const ensureConversation = async (): Promise<string | null> => {
    if (isMockMode || isSaved) return convId;
    const started = await startDirectConversation(conversation.user.id);
    if (!started.ok || !started.data) {
      toast.error(started.ok ? "Не вдалося почати розмову" : started.error);
      return null;
    }
    setConvId(started.data);
    return started.data;
  };
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 10 - pending.length);
    e.target.value = "";
    if (!files.length) return;
    if (isMockMode) return toast("Вкладення працюють лише з Supabase");
    setUploading(true);
    const target = await ensureConversation();
    if (target) {
      for (const file of files) {
        const res = await uploadChatFile(target, file);
        if (res.ok) setPending((p) => [...p, res.attachment]);
        else toast.error(`${file.name}: ${res.error}`);
      }
    }
    setUploading(false);
  };
  const pendingUrls = useSignedUrls(pending.map((a) => a.path));
  const msgUrls = useSignedUrls(messages.flatMap((m) => (m.attachments ?? []).map((a) => a.path)));
  const urls = { ...msgUrls, ...pendingUrls };

  // реакції останніх 100 повідомлень (місцевий оптимізм; чужі оновлення — при перезавантаженні)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || isMockMode) return;
    const ids = messages.slice(-100).map((m) => m.id).filter((id) => !id.startsWith("local-"));
    if (!ids.length) return;
    let cancelled = false;
    void supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", ids)
      .limit(1000)
      .then((res: { data: unknown }) => {
        const rows = (res.data as { message_id: string; user_id: string; emoji: string }[] | null) ?? [];
        if (cancelled) return;
        // іммутабельно групуємо: {emoji → count/mine}
        const grouped = new Map<string, Map<string, { count: number; mine: boolean }>>();
        for (const r of rows) {
          const byEmoji = grouped.get(r.message_id) ?? new Map();
          const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
          byEmoji.set(r.emoji, { count: cur.count + 1, mine: cur.mine || r.user_id === meId });
          grouped.set(r.message_id, byEmoji);
        }
        const map: Record<string, MessageReaction[]> = {};
        for (const [mid, byEmoji] of grouped)
          map[mid] = [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }));
        setReactions(map);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- вантажимо при зміні кількості повідомлень
  }, [messages.length, convId, meId]);

  const toggleReaction = (m: Message, emoji: string) => {
    const list = reactions[m.id] ?? [];
    const existing = list.find((r) => r.emoji === emoji);
    const on = !existing?.mine;
    setPickerFor(null);
    setReactions((map) => {
      const next = [...(map[m.id] ?? [])];
      const i = next.findIndex((r) => r.emoji === emoji);
      if (on) {
        if (i >= 0) next[i] = { ...next[i], count: next[i].count + 1, mine: true };
        else next.push({ emoji, count: 1, mine: true });
      } else if (i >= 0) {
        const c = next[i].count - 1;
        if (c <= 0) next.splice(i, 1);
        else next[i] = { ...next[i], count: c, mine: false };
      }
      return { ...map, [m.id]: next };
    });
    void reactMessage(m.id, emoji, on).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        setReactions((map) => ({ ...map, [m.id]: list }));
      }
    });
  };
  // 0021: адмін групи = творець розмови; у DM видаляє лише автор
  const isGroupAdmin = Boolean(conversation.group && conversation.createdBy && conversation.createdBy === meId);
  const canDelete = (m: Message) => !m.id.startsWith("local-") && (m.senderId === meId || isGroupAdmin);
  const beginEdit = (m: Message) => {
    setEditingId(m.id);
    setEditText(m.content);
    setPickerFor(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };
  const submitEdit = async (m: Message) => {
    const next = editText.trim();
    if (!next) return toast.error("Порожнє повідомлення");
    if (next === m.content.trim()) return cancelEdit();
    setSavingEdit(true);
    const res = await editMessage(m.id, next);
    setSavingEdit(false);
    if (!res.ok) return toast.error(res.error);
    setMessages((list) =>
      list.map((x) =>
        x.id === m.id ? { ...x, content: next, editedAt: new Date().toISOString() } : x,
      ),
    );
    cancelEdit();
  };
  const removeMessage = async (m: Message) => {
    if (!window.confirm("Видалити це повідомлення?")) return;
    const res = await deleteMessage(m.id);
    if (!res.ok) return toast.error(res.error);
    setMessages((list) => list.filter((x) => x.id !== m.id));
    setReactions((map) => {
      const next = { ...map };
      delete next[m.id];
      return next;
    });
    if (editingId === m.id) cancelEdit();
  };
  // Клік по прев'ю історії: підтягуємо живе сторіс, інакше лишається знімок
  const openStory = async (story: ChatStorySnapshot) => {
    setStoryPeek({ story, group: null, loading: true, unavailable: false })
    const res = await getStoryThread(story.id)
    if (!res.ok) {
      toast.error(res.error)
      setStoryPeek((cur) => (cur && cur.story.id === story.id ? { ...cur, loading: false, unavailable: true } : cur))
      return
    }
    setStoryPeek((cur) =>
      cur && cur.story.id === story.id ? { ...cur, loading: false, group: res.data ?? null, unavailable: !res.data } : cur,
    )
  }
  // Голосові: MediaRecorder → chat-files (audio/*), ліміт 2 хв
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopLock = useRef(false)

  const teardownRecording = () => {
    if (recTimer.current) clearInterval(recTimer.current)
    recTimer.current = null
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    recorderRef.current = null
    chunksRef.current = []
    stopLock.current = false
    setRecording(false)
    setRecSeconds(0)
  }

  const startRecording = async () => {
    if (isMockMode) return toast("Голосові працюють лише з Supabase")
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
      return toast("Цей браузер не вміє записувати звук")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      rec.onstop = () => stream.getTracks().forEach((t) => t.stop())
      recorderRef.current = rec
      rec.start(250)
      setRecording(true)
      setRecSeconds(0)
      recTimer.current = setInterval(() => {
        setRecSeconds((s) => {
          if (s >= 119) {
            void finalizeRecording(true)
            return s
          }
          return s + 1
        })
      }, 1000)
    } catch {
      toast.error("Не вдалося отримати доступ до мікрофона")
    }
  }

  /** Зупинити й надіслати (send=true) чи скасувати */
  const finalizeRecording = async (send: boolean) => {
    const rec = recorderRef.current
    if (!rec || stopLock.current) return
    stopLock.current = true
    const seconds = recSeconds
    const chunks = chunksRef.current
    const willSend = send && seconds >= 1 && chunks.length > 0
    await new Promise<void>((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true })
      rec.stop()
    })
    teardownRecording()
    if (!willSend) return
    const type = chunks[0]?.type || "audio/webm"
    const ext = type.includes("mp4") ? "m4a" : "webm"
    const file = new File(chunks, `voice-${Date.now()}.${ext}`, { type })
    setUploading(true)
    const target = await ensureConversation()
    if (target) {
      const res = await uploadChatFile(target, file, { duration: seconds })
      if (res.ok) setPending((p) => [...p, res.attachment])
      else toast.error(res.error)
    }
    setUploading(false)
  }
  const sendRecording = () => void finalizeRecording(true)
  const cancelRecording = () => void finalizeRecording(false)

  const send = async () => {
    const content = text.trim();
    const attachments = pending;
    if (!content && !attachments.length) return;
    setText("");
    setPending([]);
    const mine: Message = {
      id: `local-${crypto.randomUUID()}`,
      senderId: meId,
      content,
      createdAt: nowISO(),
      attachments,
      replyTo: replyTo?.id ?? null,
    };
    const reply = replyTo?.id ?? null;
    setReplyTo(null);
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
    const res = await sendMessage(target, content, attachments, reply);
    if (!res.ok) {
      setMessages((m) => m.filter((x) => x.id !== mine.id));
      setPending(attachments);
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
    <div className="relative flex h-full min-w-0">
    <div className="flex h-full min-w-0 flex-1 flex-col">
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
        {conversation.group ? (
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-subtle/60"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full border bg-subtle">
              <Users2 className="size-4 text-muted-foreground" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{conversation.group.title}</span>
              <span className="block text-xs text-muted-foreground">
                {typing ? <span className="text-brand">друкує…</span> : `${conversation.group.members.length + 1} учасників`}
              </span>
            </span>
          </button>
        ) : (
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
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Інформація"
          aria-pressed={infoOpen}
          onClick={() => setInfoOpen((v) => !v)}
        >
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
            const sender = mine
              ? null
              : conversation.group?.members.find((u) => u.id === m.senderId) ?? conversation.user;
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
                  "flex gap-2",
                  mine ? "justify-end" : "justify-start",
                  !grouped && i > 0 && "mt-2.5",
                )}
              >
                {!mine && (
                  <span className="w-7 shrink-0 self-end">
                    {!grouped && sender && <UserAvatar user={sender} size="sm" showOnline />}
                  </span>
                )}
                <div
                  className={cn(
                    "flex min-w-0 max-w-[78%] flex-col",
                    mine ? "items-end" : "items-start",
                  )}
                >
                  {!mine && !grouped && sender && (
                    <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">
                      {sender.name}
                    </span>
                  )}
                  <div
                    className={cn(
                      "group/msg relative min-w-0 max-w-full rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed [overflow-wrap:anywhere]",
                      mine
                        ? "bg-primary text-primary-foreground"
                        : "border bg-subtle",
                      mine && grouped && "rounded-tr-md",
                      !mine && grouped && "rounded-tl-md",
                    )}
                  >
                  {m.replyTo &&
                    (() => {
                      const parent = messages.find((x) => x.id === m.replyTo);
                      const parentName =
                        parent?.senderId === meId
                          ? "Ви"
                          : conversation.group?.members.find((u) => u.id === parent?.senderId)?.name ?? conversation.user.name;
                      return (
                        <p
                          className={cn(
                            "mb-1.5 truncate border-l-2 pl-2 text-xs",
                            mine ? "border-primary-foreground/30 text-primary-foreground/70" : "border-border text-muted-foreground",
                          )}
                        >
                          <CornerUpLeft className="mr-1 inline size-3" />
                          {parentName}
                          {parent ? `: ${messageSummary(parent.content, parent.attachments).slice(0, 90) || "вкладення"}` : ""}
                        </p>
                      );
                    })()}
                  {editingId === m.id ? (
                    <div className="flex min-w-[13rem] flex-col gap-1.5">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void submitEdit(m);
                          }
                          if (e.key === "Escape") cancelEdit();
                        }}
                        rows={2}
                        maxLength={4000}
                        autoFocus
                        className="w-full resize-none rounded-lg border bg-background px-2 py-1.5 text-[14.5px] text-foreground outline-none focus:border-ring"
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Скасувати"
                          onClick={cancelEdit}
                          className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Зберегти"
                          disabled={savingEdit}
                          onClick={() => void submitEdit(m)}
                          className="grid size-7 place-items-center rounded-full bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                        >
                          <Check className="size-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <MessageBody
                      content={m.content}
                      attachments={m.attachments}
                      urls={urls}
                      mine={mine}
                      onOpenStory={(story) => void openStory(story)}
                    />
                  )}
                  <span
                    className={cn(
                      "mt-0.5 block text-right font-mono text-[10px]",
                      mine
                        ? "text-primary-foreground/55"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatTime(m.createdAt)}
                    {m.editedAt ? " · змінено" : ""}
                  </span>

                  {/* дії: реакція й відповідь (ховер на десктопі, завжди на телефоні) */}
                  <span
                    className={cn(
                      "absolute -top-3 flex gap-0.5 rounded-full border bg-background p-0.5 shadow-sm transition-opacity md:opacity-0 md:group-hover/msg:opacity-100",
                      mine ? "right-1" : "left-1",
                    )}
                  >
                    <button
                      type="button"
                      aria-label="Реакція"
                      onClick={() => setPickerFor((v) => (v === m.id ? null : m.id))}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <SmilePlus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Відповісти"
                      onClick={() => setReplyTo(m)}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <CornerUpLeft className="size-3.5" />
                    </button>
                    {m.senderId === meId && m.content.trim() && !m.id.startsWith("local-") && (
                      <button
                        type="button"
                        aria-label="Редагувати"
                        onClick={() => beginEdit(m)}
                        className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {canDelete(m) && (
                      <button
                        type="button"
                        aria-label="Видалити"
                        onClick={() => void removeMessage(m)}
                        className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </span>

                  {/* вибір емодзі */}
                  {pickerFor === m.id && (
                    <span
                      className={cn(
                        "absolute -top-11 z-10 flex gap-0.5 rounded-full border bg-background px-1.5 py-1 shadow-lg",
                        mine ? "right-1" : "left-1",
                      )}
                    >
                      {REACTIONS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => toggleReaction(m, em)}
                          className="grid size-7 place-items-center rounded-full text-base transition-transform hover:scale-125"
                        >
                          {em}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
                {(reactions[m.id]?.length ?? 0) > 0 && (
                  <div className={cn("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
                    {reactions[m.id].map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={() => toggleReaction(m, r.emoji)}
                        aria-pressed={r.mine}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] tabular transition-colors",
                          r.mine ? "border-brand/60 bg-brand/10" : "bg-background hover:bg-subtle",
                        )}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                  </div>
                )}
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
          {replyTo && (
            <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2 rounded-lg border bg-subtle px-3 py-1.5 text-xs">
              <CornerUpLeft className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                Відповідаєте{" "}
                {replyTo.senderId === meId ? "собі" : conversation.group?.members.find((u) => u.id === replyTo.senderId)?.name ?? conversation.user.name}:{" "}
                {messageSummary(replyTo.content, replyTo.attachments).slice(0, 90) || "вкладення"}
              </span>
              <button type="button" aria-label="Скасувати відповідь" onClick={() => setReplyTo(null)} className="rounded p-0.5 hover:bg-muted">
                <X className="size-3.5" />
              </button>
            </div>
          )}
          {(pending.length > 0 || uploading) && (
            <div className="mx-auto mb-2 flex max-w-2xl flex-wrap gap-2">
              {pending.map((a) => (
                <span key={a.path} className="relative inline-flex max-w-56 items-center gap-2 rounded-lg border bg-subtle py-1 pr-7 pl-1 text-xs">
                  {a.kind === "image" && urls[a.path] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- підписаний URL
                    <img src={urls[a.path]} alt="" className="size-8 rounded object-cover" />
                  ) : (
                    <FileText className="ml-1 size-4" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate">{a.name}</span>
                    <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                  </span>
                  <button type="button" aria-label="Прибрати" onClick={() => setPending((p) => p.filter((x) => x.path !== a.path))} className="absolute top-1 right-1 rounded p-0.5 hover:bg-muted">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {uploading && <span className="self-center text-xs text-muted-foreground">Завантаження…</span>}
            </div>
          )}
          <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border bg-subtle p-1.5 pl-2 transition-colors focus-within:border-ring">
            {recording ? (
              <div className="flex min-h-8 flex-1 items-center gap-3 py-1 text-sm">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
                </span>
                <span className="font-mono tabular">{formatVoice(recSeconds)}</span>
                <span className="text-muted-foreground">Запис голосового…</span>
                <span className="ml-auto flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Скасувати запис" className="rounded-lg text-destructive" onClick={cancelRecording}>
                    <Trash2 />
                  </Button>
                  <Button type="button" size="icon-sm" aria-label="Надіслати голосове" className="rounded-lg" onClick={sendRecording}>
                    <ArrowUp />
                  </Button>
                </span>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Прикріпити"
                  className="rounded-lg"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip />
                </Button>
                <input ref={fileRef} type="file" multiple hidden onChange={onPickFile} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Записати голосове"
                  className="rounded-lg"
                  disabled={uploading}
                  onClick={startRecording}
                >
                  <Mic />
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
                <EmojiPicker onPick={(e) => setText((t) => t + e)} />
                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={(!text.trim() && !pending.length) || uploading}
                  aria-label="Надіслати"
                  className="rounded-lg"
                >
                  <ArrowUp />
                </Button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
      {infoOpen && (
        <ChatInfoPanel
          conversation={conversation}
          convId={convId}
          messages={messages}
          meId={meId}
          blocked={blocked}
          onClose={() => setInfoOpen(false)}
        />
      )}
      {storyPeek &&
        (storyPeek.group ? (
          <StoryViewer
            groups={[storyPeek.group]}
            startIndex={0}
            onClose={() => setStoryPeek(null)}
            onDeleted={() => setStoryPeek(null)}
          />
        ) : (
          <StorySnapshotViewer
            story={storyPeek.story}
            loading={storyPeek.loading}
            unavailable={storyPeek.unavailable}
            onClose={() => setStoryPeek(null)}
          />
        ))}
    </div>
  );
}

"use client"

import { useState, useTransition } from "react"
import { ArrowRightFromLine, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createPost } from "@/lib/actions/posts"
import { isMockMode } from "@/lib/env"

const MAX_IMPORT = 25

type Tweet = { tweet?: { full_text?: string; tweet_created_at?: string; in_reply_to_status_id?: string | null } }

/** Очищений текст твіту: t.co-посилання лишаюємо, решта як є; хвіст «- нік» обрізаємо */
const clean = (raw: string) =>
  raw
    .replace(/https:\/\/t\.co\/\w+\/?(\s*$)/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000)

/** Перенос дописів з архіву X (файл tweets.js із «Download an archive of your data»). */
export function XImport() {
  const [parsed, setParsed] = useState<{ text: string; at: string }[] | null>(null)
  const [fileName, setFileName] = useState("")
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(0)

  const onFile = async (file: File) => {
    setFileName(file.name)
    setParsed(null)
    setDone(0)
    try {
      const js = await file.text()
      // формат архіву: window.YTD.tweets.part0 = [ {tweet: {...}}, ... ]
      const json = js.slice(js.indexOf("=") + 1).trim().replace(/;$/, "")
      const rows = JSON.parse(json) as Tweet[]
      const items = rows
        .map((r) => r.tweet)
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
        // лише власні твіти-пости (не відповіді), з текстом
        .filter((t) => !t.in_reply_to_status_id && (t.full_text ?? "").trim())
        .map((t) => ({ text: clean(t.full_text ?? ""), at: t.tweet_created_at ?? "" }))
        .filter((t) => t.text)
        // від найстаріших — щоб зберіглася хронологія
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(0, MAX_IMPORT)
      setParsed(items)
      if (!items.length) toast("У файлі не знайшли окремих твітів-постів")
    } catch {
      toast.error("Не вдалося прочитати файл — це точно tweets.js з архіву X?")
    }
  }

  const runImport = () => {
    if (!parsed?.length) return
    startTransition(async () => {
      let ok = 0
      for (const item of parsed) {
        const res = await createPost({ content: item.text })
        if (res.ok) ok++
        else {
          toast.error(res.error)
          break
        }
        setDone(ok)
        // пауза, щоб не долошадити лічильники/стрічку
        await new Promise((r) => setTimeout(r, 350))
      }
      if (ok) toast.success(`Перенесли ${ok} ${ok === 1 ? "допис" : "дописів"}`)
    })
  }

  return (
    <Card id="x-import" className="gap-0 py-0">
      <CardHeader className="pt-5">
        <CardTitle className="flex items-center gap-2">
          <ArrowRightFromLine className="size-4.5 text-brand" /> Перенести з X
        </CardTitle>
        <CardDescription>
          Завантажте файл <code className="rounded bg-muted px-1">tweets.js</code> із архіву X (Налаштування → Ваш акаунт →
          Завантажити архів). Перенесемо до {MAX_IMPORT} останніх твітів-постів (без відповідей) у хронологічному порядку.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 pb-5">
        <input
          type="file"
          accept=".js,.json,text/javascript,application/json"
          hidden
          id="x-tweets-file"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ""
            if (f) void onFile(f)
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="rounded-full" aria-disabled={pending || isMockMode}>
            <label htmlFor="x-tweets-file" className="cursor-pointer">
              Обрати файл архіву
            </label>
          </Button>
          {fileName && <span className="max-w-56 truncate text-xs text-muted-foreground">{fileName}</span>}
          {parsed?.length ? (
            <Button className="rounded-full" disabled={pending} onClick={runImport}>
              {pending ? <Loader2 className="animate-spin" /> : `Імпортувати ${parsed.length}`}
            </Button>
          ) : null}
        </div>
        {parsed?.length ? (
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
            {pending && (
              <p className="mb-1 text-xs font-medium text-brand">
                Переносимо… {done}/{parsed.length}
              </p>
            )}
            {parsed.map((t, i) => (
              <p key={i} className="line-clamp-2 border-b pb-2 text-[13px] text-muted-foreground last:border-0 last:pb-0">
                {t.text}
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

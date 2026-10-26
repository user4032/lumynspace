"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/env"

const ASKED_KEY = "lumyn:push:asked"
const SUB_KEY = "lumyn:push:subscribed"

/** base64 (URL-safe) → Uint8Array для applicationServerKey */
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  const buf = new ArrayBuffer(raw.length)
  const arr = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  })
  if (res.ok) {
    try {
      window.localStorage.setItem(SUB_KEY, "1")
    } catch {
      /* приватний режим */
    }
    toast.success("Сповіщення увімкнено", { description: "Тепер дізнаєтесь про відповіді й світло одразу." })
  } else toast.error("Не вдалося увімкнути сповіщення")
}

async function enable() {
  const supabase = getSupabaseBrowserClient()
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (!supabase || !key || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    toast("Сповіщення не підтримуються цим браузером")
    return
  }
  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    toast("Сповіщення вимкнені в браузері", { description: "Увімкнути можна в налаштуваннях сайту." })
    return
  }
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }))
  await saveSubscription(sub)
}

/**
 * Push-підготовка в авторизованій зоні: реєструє service worker,
 * од quietly відновлює підписку і один раз за сесцію пропонує увімкнути сповіщення.
 */
export function PushSetup() {
  useEffect(() => {
    if (isMockMode || !("serviceWorker" in navigator)) return
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined)

    let asked = false
    try {
      asked = window.sessionStorage.getItem(ASKED_KEY) === "1"
    } catch {
      asked = true
    }

    const t = setTimeout(async () => {
      if (typeof Notification === "undefined") return
      const stored = (() => {
        try {
          return window.localStorage.getItem(SUB_KEY) === "1"
        } catch {
          return false
        }
      })()

      // вже погоджено, але підписка загубилась (новий браузер/через пів року) — тихо відновлюємо
      if (Notification.permission === "granted" && !stored) {
        const reg = await navigator.serviceWorker.getRegistration().catch(() => null)
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
        if (reg && key) {
          const sub = await reg.pushManager.getSubscription().catch(() => null)
          if (sub) await saveSubscription(sub)
          return
        }
      }

      // ще не питали й не вирішували — делікатно пропонуємо
      if (!asked && Notification.permission === "default") {
        try {
          window.sessionStorage.setItem(ASKED_KEY, "1")
        } catch {
          /* ок */
        }
        toast("Дізнавайтесь про відповіді одразу", {
          description: "Сповіщення приходять навіть із закритою вкладкою.",
          duration: 12_000,
          action: { label: "Увімкнути", onClick: () => void enable() },
        })
      }
    }, 3500)
    return () => clearTimeout(t)
  }, [])

  return null
}

"use client"

import { useSyncExternalStore } from "react"
import { MOCK_NOW } from "@/lib/format"
import { isMockMode } from "@/lib/env"

/**
 * Спільний «годинник»: один setInterval на всіх підписників.
 * Під час SSR/пререндеру — стабільне значення (Next з cacheComponents не дозволяє Date.now() у рендері),
 * справжній час підхоплюється одразу після гідрації.
 */
let current = 0
const SERVER_NOW = isMockMode ? MOCK_NOW : 0

function getSnapshot() {
  if (isMockMode) return MOCK_NOW
  // Date.now() не можна викликати під час пререндеру Next (cacheComponents).
  return current || SERVER_NOW
}

function subscribe(intervalMs: number) {
  return (onChange: () => void) => {
    if (isMockMode) return () => {}
    if (!current) {
      current = Date.now()
      onChange()
    }
    const t = setInterval(() => {
      current = Date.now()
      onChange()
    }, intervalMs)
    return () => clearInterval(t)
  }
}

const subscribers = new Map<number, (onChange: () => void) => () => void>()
const subscribeFor = (ms: number) => {
  let fn = subscribers.get(ms)
  if (!fn) subscribers.set(ms, (fn = subscribe(ms)))
  return fn
}

/** Поточний час, що оновлюється раз на хвилину (у демо — «заморожений» MOCK_NOW). */
export function useNow(intervalMs = 60_000) {
  return useSyncExternalStore(subscribeFor(intervalMs), getSnapshot, () => SERVER_NOW)
}

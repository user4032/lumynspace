"use client"

import { useSyncExternalStore } from "react"
import type { BannerStyle, DmPolicy, FeedPrefs, User } from "@/types"
import { currentUser } from "./mock-data"
import { DEFAULT_ACCENT } from "./accent"
import { isMockMode } from "./env"

/**
 * Стан поточного користувача в демо-режимі (localStorage).
 * Із Supabase ті самі поля живуть у profiles / close_friends / blocks / mutes,
 * а server actions з lib/actions/* синхронізують зміни з БД.
 */
export type ViewerState = {
  onboarded: boolean
  profile: {
    username: string
    name: string
    bio: string
    status: string
    statusExpiresAt: string | null
    accentColor: string
    bannerStyle: BannerStyle
    top4: string[]
    nowPlaying: { title: string; artist: string } | null
  }
  feedPrefs: FeedPrefs
  closeFriends: string[]
  blocked: string[]
  muted: string[]
  hiddenPosts: string[]
  privacy: {
    isPrivate: boolean
    dmPolicy: DmPolicy
    birthYear: number | null
    showOnline: boolean
    hideFollowing?: boolean
  }
  /** Supabase: мій рядок profiles (id, аватар, лічильники). У демо — null */
  self?: User | null
  /** Supabase: люди, яких я читаю + близькі/заблоковані/заглушені (для списків у налаштуваннях) */
  people?: User[]
}

const DEMO_VIEWER: ViewerState = {
  onboarded: true,
  profile: {
    username: currentUser.username,
    name: currentUser.name,
    bio: currentUser.bio,
    status: currentUser.status,
    statusExpiresAt: currentUser.statusExpiresAt ?? null,
    accentColor: currentUser.accentColor ?? DEFAULT_ACCENT,
    bannerStyle: currentUser.bannerStyle ?? "aurora",
    top4: currentUser.widgets?.top4 ?? [],
    nowPlaying: currentUser.widgets?.now_playing ?? null,
  },
  feedPrefs: { social: 0.5, media: 0.5 },
  closeFriends: ["u_olena", "u_maksym", "u_sofia"],
  blocked: [],
  muted: [],
  hiddenPosts: [],
  privacy: { isPrivate: false, dmPolicy: "everyone", birthYear: 2004, showOnline: true, hideFollowing: false },
}

/** Із Supabase: порожній стан до завантаження профілю (ViewerSync) — без мок-людей. */
const LIVE_VIEWER: ViewerState = {
  onboarded: true,
  profile: {
    username: "",
    name: "",
    bio: "",
    status: "",
    statusExpiresAt: null,
    accentColor: DEFAULT_ACCENT,
    bannerStyle: "aurora",
    top4: [],
    nowPlaying: null,
  },
  feedPrefs: { social: 0.5, media: 0.5 },
  closeFriends: [],
  blocked: [],
  muted: [],
  hiddenPosts: [],
  privacy: { isPrivate: false, dmPolicy: "everyone", birthYear: null, showOnline: true, hideFollowing: false },
  self: null,
  people: [],
}

export const DEFAULT_VIEWER: ViewerState = isMockMode ? DEMO_VIEWER : LIVE_VIEWER

// окремий ключ, щоб демо-дані з localStorage не змішувались зі справжнім акаунтом
const KEY = isMockMode ? "lumyn:viewer:v2" : "lumyn:viewer:live:v1"
type Listener = () => void
const listeners = new Set<Listener>()
let state: ViewerState | null = null

function load(): ViewerState {
  if (typeof window === "undefined") return DEFAULT_VIEWER
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_VIEWER
    const parsed = JSON.parse(raw) as Partial<ViewerState>
    return {
      ...DEFAULT_VIEWER,
      ...parsed,
      profile: { ...DEFAULT_VIEWER.profile, ...parsed.profile },
      feedPrefs: { ...DEFAULT_VIEWER.feedPrefs, ...parsed.feedPrefs },
      privacy: { ...DEFAULT_VIEWER.privacy, ...parsed.privacy },
    }
  } catch {
    return DEFAULT_VIEWER
  }
}

function get(): ViewerState {
  state ??= load()
  return state
}

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(l: Listener) {
  listeners.add(l)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load()
      emit()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener("storage", onStorage)
  }
}

export function setViewer(update: (s: ViewerState) => ViewerState) {
  state = update(get())
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* приватний режим / квота — працюємо в пам'яті */
  }
  emit()
}

export const viewerActions = {
  updateProfile: (p: Partial<ViewerState["profile"]>) => setViewer((s) => ({ ...s, profile: { ...s.profile, ...p } })),
  updatePrivacy: (p: Partial<ViewerState["privacy"]>) => setViewer((s) => ({ ...s, privacy: { ...s.privacy, ...p } })),
  setFeedPrefs: (p: Partial<FeedPrefs>) => setViewer((s) => ({ ...s, feedPrefs: { ...s.feedPrefs, ...p } })),
  toggle: (list: "closeFriends" | "blocked" | "muted" | "hiddenPosts", id: string, on?: boolean) =>
    setViewer((s) => {
      const has = s[list].includes(id)
      const next = on ?? !has
      if (next === has) return s
      const updated = { ...s, [list]: next ? [...s[list], id] : s[list].filter((x) => x !== id) }
      // блок прибирає людину з близьких друзів і топ-4
      if (list === "blocked" && next) {
        updated.closeFriends = updated.closeFriends.filter((x) => x !== id)
        updated.profile = { ...updated.profile, top4: updated.profile.top4.filter((x) => x !== id) }
      }
      return updated
    }),
  completeOnboarding: (p: { username: string; accentColor: string; birthYear: number }) =>
    setViewer((s) => {
      const minor = new Date().getFullYear() - p.birthYear < 18
      return {
        ...s,
        onboarded: true,
        profile: { ...s.profile, username: p.username, accentColor: p.accentColor },
        privacy: {
          ...s.privacy,
          birthYear: p.birthYear,
          // як тригер profiles_privacy_defaults у БД
          isPrivate: minor ? true : s.privacy.isPrivate,
          dmPolicy: minor ? "followers" : s.privacy.dmPolicy,
        },
      }
    }),
  reset: () => setViewer(() => DEFAULT_VIEWER),
  /** Supabase: стан із БД (profiles, close_friends, blocks, mutes, follows). hiddenPosts і showOnline — локальні */
  hydrate: (next: Omit<ViewerState, "hiddenPosts">) =>
    setViewer((s) => ({
      ...next,
      hiddenPosts: s.hiddenPosts,
      privacy: { ...next.privacy, showOnline: s.privacy.showOnline },
    })),
  setPeople: (people: User[]) => setViewer((s) => ({ ...s, people })),
}

export function useViewer(): ViewerState
export function useViewer<T>(selector: (s: ViewerState) => T): T
export function useViewer<T>(selector?: (s: ViewerState) => T) {
  const s = useSyncExternalStore(subscribe, get, () => DEFAULT_VIEWER)
  return selector ? selector(s) : s
}

export function isMinor(birthYear: number | null | undefined, year = new Date().getFullYear()) {
  return birthYear != null && year - birthYear < 18
}

const LIVE_PLACEHOLDER: User = {
  id: "",
  username: "",
  name: "",
  bio: "",
  status: "",
  joinedAt: new Date(0).toISOString(),
  followers: 0,
  following: 0,
  postsCount: 0,
}

/** Поточний користувач із застосованими налаштуваннями профілю. */
export function useMe(): User {
  const { profile, privacy, self } = useViewer()
  return {
    ...(isMockMode ? currentUser : (self ?? LIVE_PLACEHOLDER)),
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    status: profile.status,
    statusExpiresAt: profile.statusExpiresAt,
    accentColor: profile.accentColor,
    bannerStyle: profile.bannerStyle,
    widgets: { top4: profile.top4, now_playing: profile.nowPlaying },
    isPrivate: privacy.isPrivate,
    dmPolicy: privacy.dmPolicy,
    online: privacy.showOnline,
  }
}

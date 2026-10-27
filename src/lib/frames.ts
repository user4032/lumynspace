/** Каталог рамок профілю (ключі збігаються з check у міграції 0016/0017) */
export type FrameKey = "light" | "glow" | "aurora" | "star" | "hw-pumpkin" | "hw-ghost" | "hw-witch" | "venom" | "claws" | "evil"

export type FrameInfo = {
  key: FrameKey
  name: string
  price: number
  desc: string
  /** сезонна: продається лише до `until` */
  seasonal?: { label: string; until: string }
}

export const FRAMES: FrameInfo[] = [
  { key: "light", name: "Світло", price: 150, desc: "Спокійне кільце з градієнтом Lumyn" },
  { key: "glow", name: "Glow", price: 300, desc: "«Дихаюче» тепле сяйво навколо аватара" },
  { key: "aurora", name: "Аврора", price: 450, desc: "Повільно переливне полярне кільце" },
  { key: "star", name: "Зоря", price: 750, desc: "Переливи плюс орбітальні іскри" },
]

/** Хелловін-лімітед: у продажу до 3 листопада 2026 */
export const HALLOWEEN_UNTIL = "2026-11-03T23:59:59+02:00"

export const FRAMES_SEASONAL: FrameInfo[] = [
  {
    key: "hw-pumpkin",
    name: "Гарбуз",
    price: 200,
    desc: "Classic ROBLOX Pumpkin Head — гарбуз-ліхтар сидить зверху над головою",
    seasonal: { label: "Хелловін", until: HALLOWEEN_UNTIL },
  },
  {
    key: "hw-ghost",
    name: "Привид",
    price: 350,
    desc: "Три прозорі привиди літають поруч — видно лише їхні контури",
    seasonal: { label: "Хелловін", until: HALLOWEEN_UNTIL },
  },
  {
    key: "hw-witch",
    name: "Відьма",
    price: 500,
    desc: "Мітла, на якій ти літаєш — лежить під аватаром",
    seasonal: { label: "Хелловін", until: HALLOWEEN_UNTIL },
  },
]

/** Приховані рамки: немає в каталозі й у продажу — видаються лише промокодами з адмінки. */
export const FRAMES_HIDDEN: FrameInfo[] = [
  { key: "venom", name: "Веном", price: 0, desc: "Глянцеві чорні щупальця повзуть усередину" },
  { key: "claws", name: "Кігті", price: 0, desc: "Кільце із зазубрених лез, схожих на кігті" },
  { key: "evil", name: "Злий", price: 0, desc: "Аніме-символ гніву зі знаком оклику й ромбиком злості зліва зверху" },
]

export const frameByKey = (key: string | null | undefined): FrameInfo | undefined =>
  [...FRAMES, ...FRAMES_SEASONAL, ...FRAMES_HIDDEN].find((f) => f.key === key)

/** Рамка активна? (протухла — не рахуємо) */
export const frameActive = (frame: string | null | undefined, expiresAt?: string | null) =>
  Boolean(frame) && (!expiresAt || Date.parse(expiresAt) > Date.now())

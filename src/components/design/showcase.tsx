"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Bell, ChevronDown, Heart, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import { VerifiedBadge } from "@/components/verified-badge"
import { users } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const TOKENS = [
  ["background", "Фон"],
  ["subtle", "Підкладка"],
  ["muted", "Muted"],
  ["border", "Рамка 1px"],
  ["muted-foreground", "Другорядний текст"],
  ["foreground", "Текст"],
  ["brand", "Акцент"],
] as const

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-b py-6 last:border-b-0", className)}>
      <h3 className="mb-4 font-mono text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function Showcase({ mode }: { mode: "light" | "dark" }) {
  const [liked, setLiked] = useState(false)

  return (
    <div className={cn(mode, "bg-background text-foreground")}>
      <div className="flex items-center justify-between border-b px-6 py-3">
        <span className="text-sm font-medium">{mode === "dark" ? "Темна тема" : "Світла тема"}</span>
        <span className="font-mono text-xs text-muted-foreground">.{mode}</span>
      </div>
      <div className="px-6">
        <Section title="Кольори">
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {TOKENS.map(([token, label]) => (
              <div key={token} className="space-y-1.5">
                <div className="h-12 rounded-md border" style={{ background: `var(--${token})` }} />
                <p className="truncate text-xs font-medium">{label}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">--{token}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Типографіка · Geist">
          <div className="space-y-2">
            <p className="text-4xl font-semibold tracking-[-0.04em]">Соцмережа, що світиться</p>
            <p className="text-2xl font-semibold tracking-[-0.03em]">Заголовок другого рівня</p>
            <p className="text-[15px] leading-relaxed text-foreground/90">
              Основний текст 15px з міжрядковим інтервалом 1.55 — для дописів і коментарів.
            </p>
            <p className="text-sm text-muted-foreground">Другорядний текст 14px — підписи, метадані.</p>
            <p className="font-mono text-[13px] text-muted-foreground">Geist Mono 13px — const lumyn = &quot;світло&quot;</p>
          </div>
        </Section>

        <Section title="Кнопки">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Основна</Button>
            <Button variant="brand">Акцентна</Button>
            <Button variant="secondary">Другорядна</Button>
            <Button variant="outline">Контурна</Button>
            <Button variant="ghost">Прозора</Button>
            <Button variant="destructive"><Trash2 /> Видалити</Button>
            <Button variant="link">Посилання</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="xs">XS</Button>
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="secondary" aria-label="Додати"><Plus /></Button>
            <Button size="sm" disabled>Вимкнена</Button>
            <Button
              size="sm"
              variant="ghost"
              aria-pressed={liked}
              onClick={() => setLiked((v) => !v)}
              className={cn("rounded-full", liked && "text-brand")}
            >
              <Heart fill={liked ? "currentColor" : "none"} /> {liked ? 1 : 0}
            </Button>
          </div>
        </Section>

        <Section title="Поля вводу">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`email-${mode}`}>Пошта</Label>
              <Input id={`email-${mode}`} placeholder="denys@lumyn.space" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`search-${mode}`}>Пошук</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id={`search-${mode}`} placeholder="Шукати…" className="pl-9" />
              </div>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`bio-${mode}`}>Про себе</Label>
              <Textarea id={`bio-${mode}`} placeholder="Розкажіть про себе…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch defaultChecked /> Сповіщення
            </label>
          </div>
        </Section>

        <Section title="Бейджі та аватари">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Новий</Badge>
            <Badge variant="secondary">Учасник</Badge>
            <Badge variant="outline">Адмін</Badge>
            <Badge variant="outline" className="border-brand/40 text-brand">Власник</Badge>
            <Badge variant="destructive">Помилка</Badge>
            <span className="inline-flex h-5 items-center rounded border px-1.5 font-mono text-[11px] text-muted-foreground">mention</span>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex -space-x-2">
              {users.slice(0, 5).map((u) => (
                <UserAvatar key={u.id} user={u} size="lg" className="rounded-full ring-2 ring-background" />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <UserAvatar user={users[1]} size="lg" showOnline />
              <div>
                <p className="flex items-center gap-1 text-sm font-medium">{users[1].name} <VerifiedBadge /></p>
                <p className="text-xs text-muted-foreground">@{users[1].username}</p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Вкладки">
          <Tabs defaultValue="for-you">
            <TabsList>
              <TabsTrigger value="for-you">Потік</TabsTrigger>
              <TabsTrigger value="following">Коло</TabsTrigger>
              <TabsTrigger value="media">Медіа</TabsTrigger>
            </TabsList>
            <TabsContent value="for-you" className="text-muted-foreground">Рекомендовані дописи.</TabsContent>
            <TabsContent value="following" className="text-muted-foreground">Дописи людей, яких ви читаєте.</TabsContent>
            <TabsContent value="media" className="text-muted-foreground">Фото та відео.</TabsContent>
          </Tabs>
          <Tabs defaultValue="wall" className="mt-4">
            <TabsList variant="line">
              <TabsTrigger value="wall">Стіна</TabsTrigger>
              <TabsTrigger value="photos">Фото</TabsTrigger>
              <TabsTrigger value="friends">Друзі</TabsTrigger>
            </TabsList>
          </Tabs>
        </Section>

        <Section title="Картка">
          <Card className="gap-0 py-0">
            <CardHeader className="pt-5">
              <CardTitle>Ім&apos;я користувача</CardTitle>
              <CardDescription>Так вас знаходять у Lumyn.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 pb-5">
              <Input defaultValue="ozhaaar" />
            </CardContent>
            <CardFooter className="justify-between py-3">
              <span className="text-sm text-muted-foreground">Від 3 до 24 символів.</span>
              <Button size="sm">Зберегти</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Оверлеї: діалог · меню · підказка · тост">
          <div className="flex flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Відкрити діалог</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Видалити допис?</DialogTitle>
                  <DialogDescription>Допис зникне зі стрічки й профілю. Дію не можна скасувати.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary" size="sm">Скасувати</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive" size="sm" onClick={() => toast("Допис видалено")}>Видалити</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Меню <ChevronDown /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52">
                <DropdownMenuLabel>Допис</DropdownMenuLabel>
                <DropdownMenuItem>Редагувати <DropdownMenuShortcut>E</DropdownMenuShortcut></DropdownMenuItem>
                <DropdownMenuItem>Закріпити <DropdownMenuShortcut>P</DropdownMenuShortcut></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">Видалити</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="Сповіщення"><Bell /></Button>
              </TooltipTrigger>
              <TooltipContent>Сповіщення</TooltipContent>
            </Tooltip>

            <Button
              variant="secondary"
              onClick={() => toast.success("Допис опубліковано", { description: "Він уже у стрічці ваших читачів." })}
            >
              Показати тост
            </Button>
          </div>
        </Section>

        <Section title="Скелетони">
          <div className="flex gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="mt-3 h-28 w-full rounded-lg" />
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

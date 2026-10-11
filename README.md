# Lumyn

Соцмережа для тих, хто будує: стрічка як у X/Twitter, профілі й спільноти як у ВК, дизайн у стилі Vercel —
чорний фон, тонкі рамки 1px, шрифт Geist, багато повітря й **один** акцентний колір.

**Стек:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) ·
Framer Motion · next-themes · Supabase (Postgres, Auth, Storage, Realtime) через `@supabase/ssr` · деплой на Vercel.

> Без `.env.local` застосунок повністю працює в **демо-режимі** на мок-даних (`src/lib/mock-data.ts`):
> стрічка, світло, репости, опитування, коментарі, повідомлення з «друкує…» — усе інтерактивне.
> Налаштування профілю, тюнер стрічки, близькі друзі, блок/мют і онбординг у демо зберігаються в `localStorage` (ключ `lumyn:viewer:v2`).

---

## 1. Запуск локально

Потрібно: **Node.js 20.9+** (рекомендовано 22 LTS — supabase-js попереджає про Node 20) і npm.

```bash
npm i
npm run dev
```

Відкрийте http://localhost:3000. Корисні сторінки:

| Сторінка | Що там |
| --- | --- |
| `/` | Стрічка «Для тебе / Підписки», тюнер стрічки, композер, нескінченний скрол |
| `/ozhaaar` | Профіль: банер в акценті, статус із терміном, Топ-4, «зараз грає» |
| `/post/p2` | Допис із блоком коду, відповіді |
| `/c/frontend-ua` | Спільнота з ролями (owner / admin / mod / member) |
| `/messages/olena` | Особисті повідомлення |
| `/notifications` | Активність у стилі логу деплоїв Vercel |
| `/settings` | Профіль, акцент, банер, Топ-4, «зараз грає», тема |
| `/settings/privacy` | Приватний акаунт, хто може писати, інвайти, блок і мют |
| `/settings/close-friends` | Список близьких друзів |
| `/onboarding` | Реєстрація: нік, рік народження, інвайт, акцент (демо-код `LUMN-2026`) |
| `/welcome` | Лендінг із бронюванням ніка |
| `/login` | Вхід через GitHub / Google |
| `/design` | Дизайн-система: усі компоненти у світлій і темній темі |
| `/api/og?id=g1` | OG-картинка допису 1200×630 в акценті автора |
| `/api/share/g1` | Картка для сторіз 1080×1350 (`?download=1` — файл) |

**⌘K / Ctrl+K** — командна палітра: пошук людей і спільнот, навігація, перемикання теми.

Інші команди:

```bash
npm run build      # продакшн-збірка
npm run lint       # ESLint
npm run typecheck  # типи маршрутів + tsc
```

## 2. Створення проєкту Supabase

1. Зареєструйтесь на https://supabase.com → **New project** (регіон — найближчий, напр. Frankfurt).
2. **Project Settings → API** (або кнопка **Connect**): скопіюйте `Project URL` і `anon` / `publishable` ключ.
3. Створіть `.env.local` у корені проєкту (за зразком `.env.example`):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

4. Перезапустіть `npm run dev`. Плашка «Демо» в шапці зникне, а на `/login` увімкнуться кнопки входу.

> `.env.local` у `.gitignore` — не комітьте ключі. `service_role` ключ у фронтенді не потрібен узагалі.

## 3. Міграція бази даних

Файл: `supabase/migrations/0001_init.sql` — таблиці, enum-и, індекси, тригери-лічильники, автостворення профілю,
сповіщення, RLS-політики на **всіх** таблицях, бакети Storage та Realtime.

**Варіант А — SQL Editor (найпростіше):** Supabase → **SQL Editor** → New query → вставте весь вміст файлу → **Run**.

**Варіант Б — Supabase CLI:**

```bash
npx supabase login
npx supabase link --project-ref <ref-вашого-проєкту>
npx supabase db push
```

Після змін схеми можна перегенерувати типи:
`npx supabase gen types typescript --project-id <ref> > src/types/database.ts`
(зараз типи написані вручну й відповідають міграції).

Перевірити міграції локально на «голому» Postgres (із заглушками auth/storage):

```bash
DB_URL="postgresql:///postgres?host=/var/run/postgresql" bash supabase/tests/run-local.sh
```

Скрипт застосовує `0001_init.sql` → тести `01` → `0002_mvp.sql` (як окрема транзакція поверх даних, як у SQL Editor) → тести `02`.

### Що є в схемі

- `profiles`, `posts` (`media jsonb`: зображення / код / опитування, `reply_to`, `repost_of`), `lights` (колишні likes), `poll_votes`, `follows`
- `communities`, `community_members` (роль: `owner | admin | mod | member`)
- `conversations`, `conversation_members` (`last_read_at`), `messages`
- `notifications` (тип: `light | reply | follow | follow_request | friend_joined | repost | mention | message`) — створюються **тільки тригерами**
- Лічильники (`like_count`, `reply_count`, `followers_count`, `member_count`…) — тригерами; змінювати їх напряму клієнт не може (column-level grants)
- View `feed_posts` (`security_invoker`) з автором, акцентом і `viewer_has_lit`
- RPC `start_direct_conversation(other_user)` — знайти або створити діалог
- Storage-бакети `avatars`, `covers`, `post-media`: читання публічне, запис — лише у свою теку `<user_id>/…`

## 4. Вхід через GitHub і Google

URL колбеку Supabase: `https://<ref>.supabase.co/auth/v1/callback`

**GitHub:** GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**
- Homepage URL: `http://localhost:3000` (потім домен з Vercel)
- Authorization callback URL: `https://<ref>.supabase.co/auth/v1/callback`
- Скопіюйте Client ID і згенеруйте Client Secret → Supabase → **Authentication → Sign In / Providers → GitHub** → увімкніть і вставте.

**Google:** https://console.cloud.google.com → APIs & Services → **Credentials → Create OAuth client ID** (Web application)
- Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
- Client ID і Secret → Supabase → **Authentication → Providers → Google**.

Далі Supabase → **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000` (у продакшні — ваш домен)
- Redirect URLs: `http://localhost:3000/auth/callback`, `https://<ваш-домен>/auth/callback`

Після першого входу тригер `handle_new_user` автоматично створить профіль (username береться з GitHub-логіна або пошти).

## 5. Деплой на Vercel

1. Запуште репозиторій на GitHub (у **свою** гілку, через Pull Request).
2. https://vercel.com → **Add New → Project** → імпортуйте репозиторій (фреймворк визначиться сам).
3. **Environment Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL=https://<домен>`.
4. **Deploy.** Потім додайте домен Vercel у Supabase → Authentication → URL Configuration та в OAuth-додатки GitHub/Google.

## Структура

```
src/
  app/
    (auth)/login/            вхід (GitHub / Google)
    (main)/                  layout: шапка, сайдбар, права колонка, ⌘K, мобільна навігація
      page.tsx               стрічка
      [username]/            профіль
      post/[id]/             допис + відповіді (OG-метадані)
      c/[slug]/              спільнота
      messages/[[...id]]/    повідомлення
      notifications/         активність
      settings/ explore/ communities/
    api/og/                  OG-картинки (next/og)
    auth/callback/           OAuth-колбек
    design/                  дизайн-система
  components/
    ui/                      shadcn/ui, перефарбовані під Lumyn
    feed/ profile/ chat/ layout/ design/
  hooks/                     useInfiniteFeed, useRealtime (+ useTypingChannel)
  lib/
    supabase/                client.ts, server.ts, proxy.ts (оновлення сесії)
    actions/                 server actions: posts, social, auth
    mock-data.ts  feed.ts  format.ts  env.ts
  types/                     database.ts (схема БД), index.ts (моделі UI)
  proxy.ts                   Next 16 «proxy» (колишній middleware)
supabase/
  migrations/0001_init.sql
  tests/                     локальна перевірка міграції
```

## v2 — «Світло» (міграція `0002_mvp.sql`)

1. **Світло замість лайків.** `likes` → `lights`, `like_count` → `light_count`. Допис буває `permanent` або `glow`: живе 24 год, кожне світло додає годину, стеля 72 год, на 25 світлах стає постійним (константи — функції `glow_*()`, їх можна перевизначити). Прострочені glow-дописи бачить лише автор (архів), `purge_expired_glow()` прибирає їх за 7 днів (планується через pg_cron, якщо розширення є).
2. **Аудиторія.** `public | close_friends | circle`. У UI — публічно й близькі друзі; кола (`circles`, `circle_members`) готові в схемі, інтерфейс кіл — наступний етап. Видимість вирішує `security definer`-функція `can_view_post`: автор, блок, приватний акаунт (лише схвалений читач), аудиторія, термін glow.
3. **Тюнер стрічки.** `profiles.feed_prefs {social, media}` (0..1) і RPC `for_you_feed()` — та сама формула, що й у демо (`scorePost`): друзі↔рекомендації, текст↔медіа, бонус за glow, причини показу (`friend_light | community_popular | new_author | popular`). `following_feed()` — суто хронологія. Причини показуються чіпом «чому я це бачу».
4. **Приватність.** Приватний акаунт із запитами на підписку (`follows.status`), `dm_policy` (`everyone | followers | nobody`), `blocks`, `mutes`, `reports`. Для неповнолітніх (до 18) тригер ставить приватний акаунт і `dm_policy = followers`, «усі» обрати не можна; мінімальний вік — 16.
5. **Інвайти й ніки.** 5 інвайтів на людину (`create_invite`), `reserved_handles` для лендінгу (`reserve_handle`, доступна анонімам), `complete_onboarding`.
6. **Кастомізація.** `accent_color`, `banner_style` (aurora / mesh / grid / solid / image), `widgets` (Топ-4, «зараз грає»), `status_expires_at`.

**Відхилення від плану анімацій:** морф допису між маршрутами зроблено через React 19 `<ViewTransition>` (Framer `layoutId` не переходить межі App Router), зі spring-подібною кривою `linear()` і затримкою гілки 150 мс. Усе з `prefers-reduced-motion` зводиться до opacity.

## Дизайн-токени

Усі кольори — CSS-змінні в `src/app/globals.css` (`:root` / `.light` і `.dark`):
`--background`, `--foreground`, `--subtle`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`,
і **єдиний акцент** — `--brand` (у Tailwind: `bg-brand`, `text-brand`).
Винятки навмисні: `--glow` (теплий янтар для «Світла») і `--close` (смарагдовий для близьких друзів). Акцент користувача — `--accent-user`. Шрифти — пакет `geist` (Sans + Mono, з кирилицею).

## Що потребує Supabase

Схема й усі server actions уже підключені; у демо клієнт Supabase повертає `null` (`isMockMode`). Щоб увімкнути:

1. Проєкт Supabase, `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` у `.env.local`.
2. Застосувати `0001_init.sql`, потім `0002_mvp.sql`, потім `0003_first_user_invites.sql` (SQL Editor або `supabase db push`).
   0003: поки в базі немає жодного інвайту, онбординг проходить без коду (перший користувач — власник);
   щойно хтось створить інвайт (Налаштування → Приватність → «Новий інвайт»), код стає обов'язковим.
   URL у `.env.local` — без `/rest/v1/` (якщо вставити з ним, застосунок сам обріже).
3. Увімкнути **pg_cron** (Database → Extensions) — інакше прострочені glow-дописи не чистяться автоматично (функція `purge_expired_glow()` лишається).
4. OAuth-провайдери (розділ 4) і бакети Storage — уже описані в `0001`.
5. За бажання перегенерувати типи: `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`.

## Подальші етапи

Кола (аудиторія `circle`) в інтерфейсі → завантаження власного банера й аватара → модерація скарг (черга для модераторів) → реальні дані стрічки після підключення Supabase.

---

Фото в `public/mock/` — з picsum.photos (Unsplash), лише для демо.

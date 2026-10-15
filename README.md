# TG Games — монорепозиторий Telegram Mini Apps

Общий **шелл** + общий **бэкенд** + отдельные игровые **ядра**. Идея и каталог — в [`games.md`](./games.md).

## Структура

```
packages/
  shell/            # общий код всех игр (@games/shell)
    src/
      telegram.ts   # обёртка над Telegram WebApp: haptics, BackButton, openInvoice
      storage.ts    # CloudStorage с фолбэком на localStorage
      api.ts        # клиент бэкенда (авторизация initData, тихий фолбэк без него)
      payments.ts   # покупки за ⭐ Stars: buySku() — полный цикл
      grants.ts     # инбокс наград: takeGrants(<game>) на старте и после покупки
      leaderboard.ts# рекорды + лидерборд друзей (реальный с API, мок без)
      share.ts      # шеринг результата в чат + реф-ссылки (имя бота из env)
      ui/           # общие компоненты и дизайн-система «Печатная аркада»
  server/           # общий бэкенд (@games/server): бот + API в одном процессе
    src/
      auth.ts       # валидация initData (HMAC)
      db.ts         # SQLite: юзеры, рекорды, покупки, рефералки
      catalog.ts    # каталог SKU за ⭐ Stars (источник правды о ценах/наградах)
      api.ts        # Hono: /api/sync|scores|leaderboard|invoice|claim|me
      bot.ts        # grammY: /start, платежи Stars, пуши «тебя обогнали»
apps/
  water-sort/       # 🟢 Сортировка — пазл с уровнями, экономикой монет и ежедневкой
  galaxy/           # 🟡 Галактика — suika-слияние на matter.js, revive за ⭐
  snowball/         # 🔴 Снежный ком — катамари-забег 60с, +15с за ⭐
```

## Команды

```bash
npm install            # один раз, ставит зависимости всех воркспейсов

npm run dev:sort       # запустить Сортировку   (localhost:5173)
npm run dev:galaxy     # запустить Галактику
npm run dev:snowball   # запустить Снежный ком
npm run dev:server     # запустить бэкенд       (localhost:8787)

npm run typecheck      # проверить типы: все игры + сервер
npm run build:sort     # прод-сборка (аналогично :galaxy / :snowball)
```

Игры работают в обычном браузере без Телеги и без бэкенда: шелл подставляет
dev-пользователя, лидерборд — мок, покупки выдаются бесплатно с пометкой
«dev-режим». Полный локальный стек: скопировать `packages/server/.env.example`
в `.env` (можно с `NO_BOT=1 DEV_AUTH=1` — без токена), запустить `dev:server`,
а в игре создать `.env` из её `.env.example` (`VITE_API_URL`, `VITE_DEV_AUTH`).

## Монетизация (⭐ Telegram Stars)

Единый флоу: игра вызывает `buySku('<sku>')` → бэкенд создаёт инвойс
(`createInvoiceLink`, валюта XTR) → нативное окно оплаты → бот получает
`successful_payment` и записывает грант → игра забирает награду через
`takeGrants('<game>')`. Награды не начисляются клиентом — только сервером.

| SKU | Цена | Награда |
|---|---|---|
| `watersort.coins.pouch` | 10⭐ | 200 монет |
| `watersort.coins.chest` | 35⭐ | 900 монет |
| `galaxy.revive` | 15⭐ | продолжить после коллапса |
| `snowball.extra15` | 10⭐ | +15 секунд к забегу |
| `vip` | 150⭐ | ×2 монеты навсегда |
| `referral.bonus` | — | по 100 монет обоим за приглашение |

## Запуск в проде — чеклист

1. **BotFather**: создать бота, для каждой игры `/newapp` (short names),
   включить inline-кнопку меню при желании.
2. **Бэкенд**: заполнить `packages/server/.env` (`BOT_TOKEN`, `BOT_USERNAME`,
   short names), задеплоить на любой VPS (`npm run start -w @games/server`),
   поставить reverse-proxy с HTTPS.
3. **Игры**: в `apps/*/.env` прописать `VITE_API_URL` (адрес бэкенда),
   `VITE_BOT_USERNAME`, `VITE_APP_SHORT_NAME`; собрать `npm run build:*`
   и выложить `dist/` на статик-хостинг с HTTPS; URL указать в BotFather.
4. Проверить цепочку: рефералка (`?startapp=ref_<id>`), покупка за Stars,
   пуш «тебя обогнали» (приходит только тем, кто нажимал /start у бота).

## Добавить новую игру

1. Скопировать любую папку из `apps/` → переименовать (`name` в `package.json`).
2. Добавить скрипты `dev:<name>` / `build:<name>` в корневой `package.json`.
3. Добавить игру в `GAMES` в `packages/server/src/config.ts` (ключ + short name).
4. Импортировать общий функционал: `import { Screen, Button, buySku, takeGrants, submitScore } from '@games/shell'`.

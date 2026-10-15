# Moonwater · Магия цвета

Визуальное направление Water Sort: спокойная ботаническая лагуна, цветное стекло,
мятные акценты и тёплая светлая типографика. Название на экране — «Магия цвета»;
идентификатор игры, хранилище и платёжные SKU остаются `water-sort`.

## Фоны

Оба изображения созданы встроенным image_gen, без внешнего API или ключа.
Исходники 1024 × 1536 сохранены в `originals/`. В приложение подключены WebP
из `../src/assets/`: moonwater.webp (150 512 байт), dawnwater.webp (101 464 байт).
Vite добавляет хеши к именам и корректно разрешает пути при деплое в подпапку.

Уровни 1–10: «Лунная лагуна», 11–20: «Долина рассвета»; далее темы чередуются
каждые десять уровней. Ежедневка использует рассвет. Это оформление глав,
а не новый набор предзаданных головоломок: генератор уровней сохранён.

## Точные промпты

### moonwater

Use case: stylized-concept. Create a premium illustrated background asset for a relaxing mobile water sort puzzle game called Moonwater. Portrait 1024x1536. A tranquil enchanted botanical lagoon at blue hour, art-directed painterly 3D storybook illustration, deep midnight teal water, layered rounded blue mountains, a small warm ivory moon high in sky, luminous mint aquatic plants and soft pale pink water lilies at the lower corners, fine fireflies, subtle silver reflections. Restrained sophisticated colors, tactile softly painted surfaces, beautifully composed, cozy and magical without childish characters. The central 65 percent is quiet low-contrast dark teal negative space for overlaying colorful glass bottles and interface. Rich detail concentrated at outer edges and very bottom. No bottles, no characters, no text, no UI, no lettering, no logos, no watermark. Full bleed single scene, not a mockup.

### dawnwater

Use case: stylized-concept. Portrait 1024x1536 background art for premium relaxing mobile water sort puzzle. Enchanted lotus lagoon at early sunrise, hazy peach and rose sky, layered lavender mountains and distant waterfalls in upper third, deep purple teal still water occupying central 65 percent with very little detail and no highlights so UI will be readable. Warm glowing lotus blossoms, softly painted botanical leaves framing only bottom corners and far side edges. Elegant tranquil atmospheric painterly 3D storybook concept art, beautiful refined lighting. Match a moonlit magical botanical lagoon game, but sunrise chapter. Full bleed environment only. No bottles, characters, text, lettering, UI, borders or watermarks.

## Дальнейшие вариации

Для новой локации используй исходный фон как reference и меняй только окружение.
Сохраняй спокойный центр и детали по краям. Не встраивай в картинку интерфейс:
бутылки, текст и кнопки отрисовываются приложением и остаются чёткими и интерактивными.

## Проверка вручную

`npm run dev:sort` из корня репозитория. Проверить меню, обычный уровень,
ежедневку, магазин, победу, режим символов. Размеры: 320×568, 390×844,
430×932 и desktop. Особое внимание — 12 бутылок, добавленная пробирка,
длинный баланс и Telegram safe area. Анимации отключаются при reduced motion.

В текущей сессии встроенный браузер не предоставил доступных браузеров;
интерактивная визуальная проверка через него не выполнена.

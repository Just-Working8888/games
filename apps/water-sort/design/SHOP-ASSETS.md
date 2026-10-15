# Иллюстрации магазина Moonwater

Созданы встроенным image_gen. Прозрачность alpha проверена у всех четырёх WebP.
В приложении используются версии 256×256, суммарно около 86 КБ.
PNG-исходники: `originals/shop-{coins,chest,vip,gift}.png`.
Готовые игровые файлы: `../src/assets/shop-{coins,chest,vip,gift}.webp`.

## Точные промпты

Каждый объект сгенерирован отдельным запросом по этому шаблону:

> Use case: stylized-concept. Generate one isolated premium mobile game shop icon on a genuinely TRANSPARENT background with alpha. Subject: {subject}. Moonwater magical botanical lagoon aesthetic. Polished handcrafted 3D game illustration, soft rounded bevels, tactile materials, refined gold and jade palette, gentle warm highlights from upper left. Three-quarter front view. Clear bold silhouette legible at 64 pixels, centered object fills 85 percent of square canvas, generous clean edge padding. No text, letters, digits, UI, panel, ground plane, scenery, black backdrop, checkerboard or watermark. Real transparency, no background. Asset: {name}.

| name | subject |
| --- | --- |
| coins | A small open deep teal velvet coin pouch tied with a mint ribbon, three chunky gold coins spilled in front, a crescent moon embossed on the coins |
| chest | An open little treasure chest made of dark teal enamel and antique gold filigree, filled with chunky gold coins and two mint crystals |
| vip | An elegant antique gold crown with three rounded points, a luminous mint teardrop gemstone in the center and two small pearl accents |
| gift | A small luxurious deep teal gift box wrapped in a flowing cream gold satin ribbon, a mint crystal ornament on the bow |

## Перелив

Длительность: 320 мс подъём и наклон, 850 мс течение, 330 мс возврат.
Canvas накладывается поверх поля только на время перелива; исходная бутылка
сохраняет место в раскладке. Жидкость обрезается по вращающемуся контуру,
горизонтальная поверхность вычисляется по площади оставшегося объёма.
Угол наклона растёт при опустошении бутылки. Приёмник наполняется
последовательными слоями, синхронно с течением. При reduced motion используется
короткое обновление без перелёта. Геометрия объёма проверяется тестами.

Это визуальная модель двумерной жидкости, а не гидродинамический симулятор.
Для визуальной проверки: перелив между рядами, к обоим краям поля,
перелив 1–4 слоёв и частичное заполнение. В этой сессии браузерное подключение
не предоставило доступного браузера; визуальная проверка в живом UI не выполнена.

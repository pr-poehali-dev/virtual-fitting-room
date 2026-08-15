/**
 * Изображения карт Таро.
 * Файлы лежат в хранилище проекта, схема имён:
 *  - старшие арканы: 0.png ... 21.png (по порядку от Шута до Мира)
 *  - младшие числовые: 1-cups.png ... 10-wands.png
 *  - придворные: page/knight/queen/king + масть, напр. queen-swords.png
 *  - рубашка колоды: 000.png
 */

import { TAROT_MAJOR } from "./decks";

const BASE = "https://storage.yandexcloud.net/fitting-room-images/images/tarot";

export const TAROT_BACK_IMAGE = `${BASE}/000.png`;

// Масть в названии карты -> кусок имени файла
const SUIT_FILE: Record<string, string> = {
  Жезлов: "wands",
  Кубков: "cups",
  Мечей: "swords",
  Пентаклей: "pentacles",
};

// Ранг в названии карты -> кусок имени файла
const RANK_FILE: Record<string, string> = {
  Туз: "1",
  Двойка: "2",
  Тройка: "3",
  Четвёрка: "4",
  Пятёрка: "5",
  Шестёрка: "6",
  Семёрка: "7",
  Восьмёрка: "8",
  Девятка: "9",
  Десятка: "10",
  Паж: "page",
  Рыцарь: "knight",
  Королева: "queen",
  Король: "king",
};

/** Возвращает адрес картинки для карты Таро по её русскому названию. */
export const getTarotImageByName = (name: string): string | undefined => {
  if (!name) return undefined;

  const majorIndex = TAROT_MAJOR.indexOf(name);
  if (majorIndex >= 0) return `${BASE}/${majorIndex}.png`;

  const parts = name.trim().split(" ");
  const suitRu = parts[parts.length - 1];
  const rankRu = parts.slice(0, -1).join(" ");

  const suit = SUIT_FILE[suitRu];
  const rank = RANK_FILE[rankRu];
  if (!suit || !rank) return undefined;

  return `${BASE}/${rank}-${suit}.png`;
};

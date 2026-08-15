/**
 * Реестр раскладов для интерфейса (зеркало backend/ai-editor-start/divination/spreads.py).
 * Новый расклад = новая запись здесь и в бэкенде.
 */

export type DeckId = "lenormand" | "tarot";

export interface SpreadDef {
  id: string;
  deck: DeckId;
  title: string;
  short: string;
  size: number;
  grid: { cols: number; rows: number; tail?: number } | null;
  positions?: string[];
  /** Расклад-диалог: вопрос → карты → ответ → уточняющий вопрос */
  dialog?: boolean;
  icon: string;
}

export const SPREADS: SpreadDef[] = [
  {
    id: "lenormand_big9x4",
    deck: "lenormand",
    title: "Большой расклад 9×4",
    short: "36 карт, полная картина жизни",
    size: 36,
    grid: { cols: 9, rows: 4 },
    icon: "LayoutGrid",
  },
  {
    id: "lenormand_big8x4plus4",
    deck: "lenormand",
    title: "Большой расклад 8×4 + 4",
    short: "36 карт: поле 8×4 и 4 итоговые карты внизу",
    size: 36,
    grid: { cols: 8, rows: 4, tail: 4 },
    icon: "Grid2x2",
  },
  {
    id: "lenormand_line3",
    deck: "lenormand",
    title: "Три карты",
    short: "Короткий ответ на вопрос",
    size: 3,
    grid: { cols: 3, rows: 1 },
    dialog: true,
    icon: "Rows3",
  },
  {
    id: "lenormand_card1",
    deck: "lenormand",
    title: "Одна карта",
    short: "Быстрый совет дня",
    size: 1,
    grid: { cols: 1, rows: 1 },
    dialog: true,
    icon: "Square",
  },
  {
    id: "tarot_card1",
    deck: "tarot",
    title: "Одна карта",
    short: "Быстрый совет дня",
    size: 1,
    grid: { cols: 1, rows: 1 },
    dialog: true,
    icon: "Square",
  },
  {
    id: "tarot_line3",
    deck: "tarot",
    title: "Прошлое — Настоящее — Будущее",
    short: "Развитие ситуации во времени",
    size: 3,
    grid: { cols: 3, rows: 1 },
    positions: ["Прошлое", "Настоящее", "Будущее"],
    dialog: true,
    icon: "Rows3",
  },
  {
    id: "tarot_celtic10",
    deck: "tarot",
    title: "Кельтский крест",
    short: "10 карт, глубокий разбор ситуации",
    size: 10,
    grid: null,
    positions: [
      "Суть ситуации",
      "Что помогает или мешает",
      "Основа, корень",
      "Недавнее прошлое",
      "Возможное будущее",
      "Ближайший шаг",
      "Вы сами",
      "Окружение",
      "Надежды и страхи",
      "Итог",
    ],
    icon: "Cross",
  },
];

export const getSpread = (id: string): SpreadDef | undefined =>
  SPREADS.find((s) => s.id === id);

export const spreadsByDeck = (deck: DeckId): SpreadDef[] =>
  SPREADS.filter((s) => s.deck === deck);

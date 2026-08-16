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
  /** Толковать можно только при полностью выложенном столе */
  requireFull?: boolean;
  /** Сколько карт можно выбрать (для диалогов) */
  flexible?: { min: number; max: number };
  /** Расклад-диалог: вопрос → карты → ответ → уточняющий вопрос */
  dialog?: boolean;
  /** Особая фигура на столе (не прямоугольная сетка) */
  shape?: "celtic";
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
    requireFull: true,
    icon: "LayoutGrid",
  },
  {
    id: "lenormand_big8x4plus4",
    deck: "lenormand",
    title: "Большой расклад 8×4 + 4",
    short: "36 карт: поле 8×4 и 4 итоговые карты внизу",
    size: 36,
    grid: { cols: 8, rows: 4, tail: 4 },
    requireFull: true,
    icon: "Grid2x2",
  },
  {
    id: "lenormand_dialog",
    deck: "lenormand",
    title: "Диалог на картах Ленорман",
    short: "Вопрос, карты, ответ — и уточнения",
    size: 6,
    flexible: { min: 1, max: 6 },
    grid: { cols: 6, rows: 1 },
    dialog: true,
    icon: "MessagesSquare",
  },
  {
    id: "tarot_dialog",
    deck: "tarot",
    title: "Диалог на картах Таро",
    short: "Вопрос, карты, ответ — и уточнения",
    size: 6,
    flexible: { min: 1, max: 6 },
    grid: { cols: 6, rows: 1 },
    dialog: true,
    icon: "MessagesSquare",
  },
  {
    id: "tarot_celtic10",
    deck: "tarot",
    title: "Кельтский крест",
    short: "10 карт, глубокий разбор ситуации",
    size: 10,
    grid: null,
    positions: [
      "Вот в чём дело",
      "А вот к нему ключик",
      "Вот что на сердце",
      "Вот что под сердцем",
      "Что было",
      "Что будет",
      "Для себя",
      "Для других",
      "Надежды и опасения",
      "Чем дело кончится",
    ],
    // Крест читается только целиком: связи 1-2-6-10 без полной выкладки не работают
    requireFull: true,
    shape: "celtic",
    icon: "Cross",
  },
];

export const getSpread = (id: string): SpreadDef | undefined =>
  SPREADS.find((s) => s.id === id);

export const spreadsByDeck = (deck: DeckId): SpreadDef[] =>
  SPREADS.filter((s) => s.deck === deck);
/**
 * Колоды карт для интерфейса.
 * Зеркало backend/ai-editor-start/divination/decks.py — порядок карт обязан совпадать.
 */

import { CARD_NAMES as LENORMAND_CARDS } from "@/data/lenormand";
import type { DeckId } from "./spreads";

export const TAROT_MAJOR: string[] = [
  "Шут",
  "Маг",
  "Верховная Жрица",
  "Императрица",
  "Император",
  "Иерофант",
  "Влюблённые",
  "Колесница",
  "Сила",
  "Отшельник",
  "Колесо Фортуны",
  "Справедливость",
  "Повешенный",
  "Смерть",
  "Умеренность",
  "Дьявол",
  "Башня",
  "Звезда",
  "Луна",
  "Солнце",
  "Суд",
  "Мир",
];

const SUITS = ["Жезлов", "Кубков", "Мечей", "Пентаклей"];
const RANKS = [
  "Туз",
  "Двойка",
  "Тройка",
  "Четвёрка",
  "Пятёрка",
  "Шестёрка",
  "Семёрка",
  "Восьмёрка",
  "Девятка",
  "Десятка",
  "Паж",
  "Рыцарь",
  "Королева",
  "Король",
];

export const TAROT_MINOR: string[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => `${rank} ${suit}`),
);

export const TAROT_CARDS: string[] = [...TAROT_MAJOR, ...TAROT_MINOR];

export interface DeckDef {
  id: DeckId;
  title: string;
  desc: string;
  cards: string[];
  /** У Ленорман позиции расклада называются домами */
  houseNames?: string[];
  icon: string;
}

export const DECKS: Record<DeckId, DeckDef> = {
  lenormand: {
    id: "lenormand",
    title: "Ленорман",
    desc: "36 карт, конкретика и бытовые ситуации",
    cards: LENORMAND_CARDS,
    houseNames: LENORMAND_CARDS,
    icon: "Spade",
  },
  tarot: {
    id: "tarot",
    title: "Таро",
    desc: "78 карт, глубокий образный разбор",
    cards: TAROT_CARDS,
    icon: "Sparkles",
  },
};

export const getDeck = (id: DeckId): DeckDef => DECKS[id] ?? DECKS.lenormand;

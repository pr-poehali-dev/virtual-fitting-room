/**
 * Общие типы диалога-гадания.
 *
 * Вынесены в отдельный файл, чтобы дочерние компоненты брали тип отсюда,
 * а не из DialogChat.tsx — иначе получается кольцевой импорт.
 */
export interface DialogStep {
  step_no: number;
  question: string;
  cards: string[];
  answer: string;
}

export const GENERATION_COST = 50;
export const COLORTYPE_COST = 50;
export const COLORGUIDE_COST = 50;
export const STYLE_ANALYSIS_COST = 50;
export const OUTFIT_SELECTION_COST = 50;
export const GIFT_SELECTION_COST = 50;
export const PERFUME_SELECTION_COST = 50;
export const WEDDING_SELECTION_COST = 50;
export const LENORMAND_COST = 50;
export const MIN_TOPUP = 50;

// Нейросети-гадалки (общий список для гаданий)
export interface AiOracle {
  value: string;
  code: string;
  label: string;
  desc: string;
}

export const LENORMAND_AI: AiOracle[] = [
  {
    value: "google/gemini-2.5-flash",
    code: "GF",
    label: "Гадалка GF — быстрый разбор",
    desc: "Быстрый ответ, базовое толкование",
  },
  {
    value: "anthropic/claude-sonnet-4.6",
    code: "CS",
    label: "Гадалка CS — подробный",
    desc: "Подробное развёрнутое толкование",
  },
];

// Цена одного шага диалога (вопрос + карты + ответ)
export const DIALOG_STEP_PRICES: Record<string, number> = {
  "google/gemini-2.5-flash": 10,
  "anthropic/claude-sonnet-4.6": 25,
};

// Матрица цен: расклад × модель (источник правды для фронта).
// В будущем легко вынести в БД/админку без изменения вызывающего кода.
export const DIVINATION_PRICES: Record<string, Record<string, number>> = {
  lenormand_big9x4: {
    "google/gemini-2.5-flash": 50,
    "anthropic/claude-sonnet-4.6": 100,
  },
  lenormand_big8x4plus4: {
    "google/gemini-2.5-flash": 50,
    "anthropic/claude-sonnet-4.6": 100,
  },
  tarot_celtic10: {
    "google/gemini-2.5-flash": 50,
    "anthropic/claude-sonnet-4.6": 100,
  },
  tarot_plan5: {
    "google/gemini-2.5-flash": 50,
    "anthropic/claude-sonnet-4.6": 100,
  },
  // Расклады-диалоги: цена за ОДИН шаг (вопрос + карты + ответ)
  lenormand_dialog: DIALOG_STEP_PRICES,
  tarot_dialog: DIALOG_STEP_PRICES,
};

// Максимум шагов в одном диалоге
export const DIALOG_MAX_STEPS = 30;

export const getDivinationPrice = (spread: string, model: string): number => {
  const table = DIVINATION_PRICES[spread] || {};
  return table[model] ?? LENORMAND_COST;
};

export const getDivinationMinPrice = (spread: string): number => {
  const table = DIVINATION_PRICES[spread] || {};
  const values = Object.values(table);
  return values.length ? Math.min(...values) : LENORMAND_COST;
};

export const LENORMAND_SPREAD = "lenormand_big9x4";
export const GENERATION_COST = 50;
export const COLORTYPE_COST = 50;
export const COLORGUIDE_COST = 50;
export const STYLE_ANALYSIS_COST = 50;
export const OUTFIT_SELECTION_COST = 100;
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
  {
    value: "anthropic/claude-opus-4.6",
    code: "CO",
    label: "Гадалка CO — глубинный",
    desc: "Самый детальный, глубинный разбор",
  },
];

// Матрица цен: расклад × модель (источник правды для фронта).
// В будущем легко вынести в БД/админку без изменения вызывающего кода.
export const DIVINATION_PRICES: Record<string, Record<string, number>> = {
  lenormand_big9x4: {
    "google/gemini-2.5-flash": 50,
    "anthropic/claude-sonnet-4.6": 100,
    "anthropic/claude-opus-4.6": 150,
  },
};

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
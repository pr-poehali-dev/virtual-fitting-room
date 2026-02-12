/**
 * Правила для 12 цветотипов
 * Определяют какие палитры использовать и какие CSS фильтры применять
 */

export type ColorTypeName =
  | "DUSTY_SUMMER"
  | "VIVID_SUMMER"
  | "SOFT_SUMMER"
  | "FIERY_AUTUMN"
  | "GENTLE_AUTUMN"
  | "VIVID_AUTUMN"
  | "BRIGHT_WINTER"
  | "VIVID_WINTER"
  | "SOFT_WINTER"
  | "VIBRANT_SPRING"
  | "BRIGHT_SPRING"
  | "GENTLE_SPRING";

export type SeasonKey =
  | "summer"
  | "summerBright"
  | "autumn"
  | "autumnBright"
  | "winter"
  | "winterBright"
  | "spring"
  | "springBright";

export interface ColorTypeRule {
  name: ColorTypeName;
  displayName: string;
  season: SeasonKey;
  filter?: string;
}

export const colorTypeRules: Record<ColorTypeName, ColorTypeRule> = {
  // ========== ЛЕТО ==========
  DUSTY_SUMMER: {
    name: "DUSTY_SUMMER",
    displayName: "Пыльное Лето",
    season: "summer",
  },
  VIVID_SUMMER: {
    name: "VIVID_SUMMER",
    displayName: "Яркое Лето",
    season: "summerBright",
  },
  SOFT_SUMMER: {
    name: "SOFT_SUMMER",
    displayName: "Мягкое Лето",
    season: "summerBright",
    filter: "brightness(1.15)",
  },

  // ========== ОСЕНЬ ==========
  FIERY_AUTUMN: {
    name: "FIERY_AUTUMN",
    displayName: "Огненная Осень",
    season: "autumnBright",
  },
  GENTLE_AUTUMN: {
    name: "GENTLE_AUTUMN",
    displayName: "Нежная Осень",
    season: "autumn",
  },
  VIVID_AUTUMN: {
    name: "VIVID_AUTUMN",
    displayName: "Яркая Осень",
    season: "autumn",
    filter: "brightness(0.85)",
  },

  // ========== ЗИМА ==========
  BRIGHT_WINTER: {
    name: "BRIGHT_WINTER",
    displayName: "Яркая Зима",
    season: "winterBright",
  },
  VIVID_WINTER: {
    name: "VIVID_WINTER",
    displayName: "Контрастная Зима",
    season: "winter",
    filter: "brightness(0.85)",
  },
  SOFT_WINTER: {
    name: "SOFT_WINTER",
    displayName: "Мягкая Зима",
    season: "winter",
  },

  // ========== ВЕСНА ==========
  VIBRANT_SPRING: {
    name: "VIBRANT_SPRING",
    displayName: "Яркая Весна",
    season: "springBright",
  },
  BRIGHT_SPRING: {
    name: "BRIGHT_SPRING",
    displayName: "Тёплая Весна",
    season: "spring",
  },
  GENTLE_SPRING: {
    name: "GENTLE_SPRING",
    displayName: "Нежная Весна",
    season: "springBright",
    filter: "brightness(1.15)",
  },
};

/**
 * Получить палитры для конкретного цветотипа с применением фильтров
 */
export function getPalettesForColorType(colorType: ColorTypeName) {
  const rule = colorTypeRules[colorType];
  return {
    season: rule.season,
    filter: rule.filter,
    displayName: rule.displayName,
  };
}

/**
 * Получить список всех цветотипов
 */
export function getAllColorTypes(): ColorTypeRule[] {
  return Object.values(colorTypeRules);
}

/**
 * Получить цветотипы по сезону
 */
export function getColorTypesBySeason(
  season: "summer" | "autumn" | "winter" | "spring",
): ColorTypeRule[] {
  return Object.values(colorTypeRules).filter(
    (rule) => rule.season === season || rule.season === `${season}Bright`,
  );
}
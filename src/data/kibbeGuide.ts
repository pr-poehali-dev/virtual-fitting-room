// Инструкция «Как определить типаж по Кибби самостоятельно».
// Тексты и картинки вынесены сюда, чтобы страница теста осталась лёгкой,
// а правки контента делались в одном месте.

export const GUIDE_IMAGES = {
  // Силуэты с красными линиями ткани — к шагу 2
  lines:
    'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/1ecac995-f0ad-4726-8013-e4fa99840478.jpg',
  // 10 типажей внешности — к шагу 3
  types:
    'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/35fdfd78-5f83-4c7b-bac0-16577093e0e7.jpg',
  // 10 идеальных платьев по типам фигур — в конце инструкции
  dresses:
    'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/eb477fb3-c8c8-45a8-92e5-264cbecbfa4c.jpg',
};

export interface GuideLine {
  title: string;
  latin: string;
  text: string;
}

/** Шаг 2: варианты дополнительной линии */
export const GUIDE_LINES: GuideLine[] = [
  {
    title: 'Узкая',
    latin: 'Narrow',
    text: 'Ткань идёт прямо вниз, оставаясь в пределах линии плеч, силуэт узкий',
  },
  {
    title: 'Ширина',
    latin: 'Width',
    text: 'Ткань «выталкивается» в области плеч и верхней части тела',
  },
  {
    title: 'Изогнутая',
    latin: 'Curve',
    text: 'Ткань огибает грудь и бёдра, создавая выраженные изгибы',
  },
  {
    title: 'Двойной изгиб',
    latin: 'Double Curve',
    text: 'Два эллипса — грудь и бёдра — с явной талией между ними',
  },
  {
    title: 'Баланс',
    latin: 'Balance',
    text: 'Всё равномерно, нет резких выступов или впадин',
  },
  {
    title: 'Миниатюрная',
    latin: 'Petite',
    text: 'Компактная фигура, всё «упаковано» в маленькую рамку',
  },
];

export interface GuideCombo {
  /** Номер из шпаргалки */
  number: number;
  dominance: string;
  line: string;
  /** Ключ типажа в KIBBE_TYPES */
  typeKey: string;
}

/** Шаг 3: доминанта + дополнительная линия = типаж */
export const GUIDE_COMBOS: GuideCombo[] = [
  { number: 1, dominance: 'Вертикаль', line: 'Узкая', typeKey: 'dramatic' },
  { number: 2, dominance: 'Вертикаль', line: 'Ширина', typeKey: 'flamboyant_natural' },
  { number: 3, dominance: 'Вертикаль', line: 'Изогнутая', typeKey: 'soft_dramatic' },
  { number: 4, dominance: 'Вертикаль', line: 'Баланс', typeKey: 'dramatic_classic' },
  { number: 5, dominance: 'Вертикаль', line: 'Миниатюрная', typeKey: 'flamboyant_gamine' },
  { number: 6, dominance: 'Изогнутая', line: 'Двойной изгиб', typeKey: 'romantic' },
  { number: 7, dominance: 'Изогнутая', line: 'Узкая', typeKey: 'theatrical_romantic' },
  { number: 8, dominance: 'Изогнутая', line: 'Ширина', typeKey: 'soft_natural' },
  { number: 9, dominance: 'Изогнутая', line: 'Баланс', typeKey: 'soft_classic' },
  { number: 10, dominance: 'Изогнутая', line: 'Миниатюрная', typeKey: 'soft_gamine' },
];

/** Блок «Важно» под инструкцией */
export const GUIDE_NOTES: string[] = [
  'Если рост 168 см и выше — доминанта всегда «Вертикаль», даже если вы видите изгибы.',
  'Для доминанты «Изогнутая» рост должен быть ниже 168 см.',
  'Смотрите не на отдельные части тела, а на общую линию силуэта.',
];

/** Адрес статьи типажа: ключ dramatic_classic → /kibbe-types/dramatic-classic */
export function typeSlug(typeKey: string): string {
  return typeKey.replace(/_/g, '-');
}

/** Обратное преобразование: dramatic-classic → dramatic_classic */
export function slugToTypeKey(slug: string): string {
  return slug.replace(/-/g, '_');
}

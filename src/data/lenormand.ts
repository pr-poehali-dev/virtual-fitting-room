// Данные раскладов Ленорман для фронтенда.
// Порядок домов и карт совпадает с backend/ai-editor-start/lenormand.py

export const HOUSE_NAMES: string[] = [
  'Всадник', 'Клевер', 'Корабль', 'Дом', 'Дерево', 'Тучи', 'Змея', 'Гроб',
  'Букет', 'Коса', 'Метла', 'Птицы', 'Ребёнок', 'Лиса', 'Медведь', 'Звёзды',
  'Аист', 'Собака', 'Башня', 'Сад', 'Гора', 'Развилка', 'Крысы', 'Сердце',
  'Кольцо', 'Книга', 'Письмо', 'Мужчина', 'Женщина', 'Лилии', 'Солнце', 'Луна',
  'Ключ', 'Рыбы', 'Якорь', 'Крест',
];

// Карты колоды Ленорман — совпадают по названиям с домами.
export const CARD_NAMES: string[] = [...HOUSE_NAMES];

export type PeriodKey = 'now' | 'week' | 'month' | '3months' | '6months' | 'year';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'now', label: 'Сейчас, сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: '3months', label: '3 месяца' },
  { key: '6months', label: '6 месяцев' },
  { key: 'year', label: '1 год' },
];

export type GenderKey = 'female' | 'male';

export const GENDERS: { key: GenderKey; label: string }[] = [
  { key: 'female', label: 'Женщина' },
  { key: 'male', label: 'Мужчина' },
];

export type SphereKey =
  | 'outfit'
  | 'relationships'
  | 'career'
  | 'finance'
  | 'beauty'
  | 'all';

export const SPHERES: { key: SphereKey; label: string }[] = [
  { key: 'outfit', label: 'Как одеваться, какой стиль выбирать' },
  { key: 'relationships', label: 'Личные отношения' },
  { key: 'career', label: 'Профессиональная деятельность' },
  { key: 'finance', label: 'Финансы' },
  { key: 'beauty', label: 'Персональные советы по моде и красоте' },
  { key: 'all', label: 'Все сферы' },
];
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

export type PeriodKey = 'now' | 'week' | 'month' | '3months';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'now', label: 'Сейчас, сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: '3months', label: '3 месяца' },
];

export type GenderKey = 'female' | 'male';

export const GENDERS: { key: GenderKey; label: string }[] = [
  { key: 'female', label: 'Женщина' },
  { key: 'male', label: 'Мужчина' },
];

export type SphereKey = 'outfit' | 'relationships' | 'career' | 'all';

export const SPHERES: { key: SphereKey; label: string }[] = [
  { key: 'outfit', label: 'Как одеться сегодня' },
  { key: 'relationships', label: 'Личные отношения' },
  { key: 'career', label: 'Профессиональная деятельность' },
  { key: 'all', label: 'Все сферы' },
];

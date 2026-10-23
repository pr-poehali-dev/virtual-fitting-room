export const GENDERS = ["Женский", "Мужской"];

export const KIBBE_TYPES = [
  "Dramatic (Драматик)",
  "Soft Dramatic (Мягкий драматик)",
  "Flamboyant Natural (Яркий натурал)",
  "Soft Natural (Мягкий натурал)",
  "Dramatic Classic (Драматик классик)",
  "Soft Classic (Мягкий классик)",
  "Flamboyant Gamine (Яркий гамин)",
  "Soft Gamine (Мягкий гамин)",
  "Theatrical Romantic (Театральный романтик)",
  "Romantic (Романтик)",
];

export const ARCHETYPES = [
  "Невинный",
  "Мудрец",
  "Искатель",
  "Бунтарь",
  "Маг",
  "Герой",
  "Любовник",
  "Шут",
  "Славный малый",
  "Заботливый",
  "Творец",
  "Правитель",
];

export const COLORTYPES = [
  "Светлая весна",
  "Тёплая весна",
  "Яркая весна",
  "Светлое лето",
  "Холодное лето",
  "Мягкое лето",
  "Мягкая осень",
  "Тёплая осень",
  "Глубокая осень",
  "Глубокая зима",
  "Холодная зима",
  "Яркая зима",
];

export const HAIR_LENGTHS = ["Короткие", "До плеч", "Средние", "Длинные"];

export const TAGS = [
  "Минимализм",
  "Элегантность",
  "Романтично",
  "Casual",
  "Удобный",
  "Практичный",
  "Не как у всех",
  "Яркий и запоминающийся",
  "Сдержанный",
  "Монохром",
  "Акцент на аксессуары",
];

export const COLORS = [
  "Чёрный",
  "Белый",
  "Бежевый",
  "Серый",
  "Синий",
  "Голубой",
  "Зелёный",
  "Изумрудный",
  "Красный",
  "Бордовый",
  "Розовый",
  "Пудровый",
  "Жёлтый",
  "Оранжевый",
  "Коричневый",
  "Фиолетовый",
  "Бирюзовый",
  "Золотой",
  "Серебряный",
];

export const FABRICS = [
  "Хлопок",
  "Лён",
  "Шёлк",
  "Шерсть",
  "Кашемир",
  "Трикотаж",
  "Деним",
  "Кожа",
  "Замша",
  "Вискоза",
  "Атлас",
  "Синтетика",
];

export const PATTERNS = [
  "Однотонное",
  "Полоска",
  "Клетка",
  "Горох",
  "Цветочный",
  "Геометрия",
  "Анималистичный",
  "Этнический",
];

export const SKIRT_LENGTHS = [
  "Мини",
  "До колена",
  "Миди",
  "Макси",
  "В пол",
  "Не ношу юбки",
];

export const TRIP_SEASONS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export const DEPARTURE_WEATHER = [
  "Мороз",
  "Холодно",
  "Прохладно",
  "Тепло",
  "Жарко",
];

export const TRANSPORTS = ["Самолёт", "Поезд", "Машина", "Автобус", "Корабль"];

export const TRAVEL_TIMES = [
  "До 3 часов",
  "3–6 часов",
  "6–12 часов",
  "Больше 12 часов",
  "С пересадками",
];

export const ACTIVITIES = [
  "Экскурсии",
  "Пляж",
  "Шопинг",
  "Рестораны и вечерние выходы",
  "Горы и прогулки",
  "Деловые встречи",
  "Вечеринки",
  "Фотосессия",
  "Спа и отдых",
  "Активный спорт",
  "Театр / концерт",
];

export const LUGGAGE = ["Только ручная кладь", "Чемодан"];

export const MAX_ARCHETYPES = 4;
export const MAX_COLORTYPES = 2;

export interface TravelFormParams {
  destination?: string;
  trip_season?: string;
  trip_days?: number | string;
  departure_city?: string;
  departure_weather?: string;
  transport?: string;
  travel_time?: string;
  activities?: string[];
  luggage?: string;
  gender?: string;
  height?: number | string;
  kibbe?: string;
  archetypes?: string[];
  colortypes?: string[];
  hair_length?: string;
  hair_color?: string;
  eye_color?: string;
  tags?: string[];
  favorite_colors?: string[];
  disliked_colors?: string[];
  favorite_fabrics?: string[];
  disliked_fabrics?: string[];
  favorite_patterns?: string[];
  disliked_patterns?: string[];
  skirt_length?: string;
  style_age?: string | number;
  comment?: string;
}

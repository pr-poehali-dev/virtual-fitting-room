import {
  KIBBE_TYPES,
  ARCHETYPES,
  COLORTYPES,
  MAX_ARCHETYPES,
  MAX_COLORTYPES,
} from "@/lib/travelOptions";

export type FieldType = "select" | "chips" | "text" | "textarea" | "number";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  max?: number;
  wide?: boolean;
}

export type FieldValues = Record<string, string | string[]>;

export const PERSON_FIELDS: FieldDef[] = [
  { key: "client_name", label: "Имя", type: "text", required: true, placeholder: "По нему сохраним анкету" },
  { key: "gender", label: "Пол", type: "select", options: ["Женский", "Мужской"], required: true },
  { key: "age", label: "Возраст", type: "number", placeholder: "Например, 32" },
  { key: "height", label: "Рост, см", type: "number", placeholder: "Например, 168" },
  { key: "weight", label: "Вес, кг", type: "number", placeholder: "Например, 62" },
  {
    key: "blood_type",
    label: "Группа крови",
    type: "select",
    options: ["I (0)", "II (A)", "III (B)", "IV (AB)", "Не знаю"],
  },
  { key: "city", label: "Город / регион", type: "text", placeholder: "Например, Екатеринбург" },
  {
    key: "climate",
    label: "Климат проживания",
    type: "select",
    options: [
      "Холодный, долгая зима",
      "Умеренный",
      "Тёплый, мягкая зима",
      "Жаркий сухой",
      "Жаркий влажный",
      "Морской",
      "Горный",
    ],
  },
  { key: "season", label: "Текущий сезон", type: "select", options: ["Зима", "Весна", "Лето", "Осень"] },
  { key: "kibbe", label: "Типаж по Кибби", type: "select", options: KIBBE_TYPES },
  { key: "archetypes", label: "Архетип(ы) по Юнгу", type: "chips", options: ARCHETYPES, max: MAX_ARCHETYPES, hint: "до 4", wide: true },
  { key: "colortypes", label: "Цветотип", type: "chips", options: COLORTYPES, max: MAX_COLORTYPES, hint: "до 2", wide: true },
  {
    key: "health",
    label: "Ограничения по здоровью",
    type: "textarea",
    placeholder: "Например: колени, давление, беременность, хронические заболевания",
    wide: true,
  },
  { key: "comment", label: "Комментарий", type: "textarea", placeholder: "Любые пожелания", wide: true },
];

export const WEEK_FIELDS: FieldDef[] = [
  { key: "week_number", label: "Какая это неделя по счёту", type: "number", placeholder: "1" },
  {
    key: "last_week_feedback",
    label: "Как прошла прошлая неделя",
    type: "textarea",
    placeholder: "Что получилось, что было сложно или не понравилось — учтём в новом плане",
    wide: true,
  },
];

export const SPORT_FIELDS: FieldDef[] = [
  {
    key: "goals",
    label: "Цель",
    type: "chips",
    options: ["Похудеть", "Тонус", "Сила", "Гибкость", "Осанка", "Выносливость", "Энергия", "Снять стресс"],
    required: true,
    wide: true,
  },
  {
    key: "fitness_level",
    label: "Уровень подготовки",
    type: "select",
    options: ["Новичок", "Занимаюсь иногда", "Регулярно тренируюсь", "Продвинутый"],
    required: true,
  },
  {
    key: "time_per_day",
    label: "Время на занятие",
    type: "select",
    options: ["15 минут", "20–30 минут", "30–45 минут", "45–60 минут", "Больше часа"],
    required: true,
  },
  { key: "days_per_week", label: "Дней в неделю", type: "select", options: ["2", "3", "4", "5", "6", "7"] },
  {
    key: "body_shape",
    label: "Тип фигуры",
    type: "select",
    options: ["Песочные часы", "Груша", "Яблоко", "Прямоугольник", "Перевёрнутый треугольник", "Не знаю"],
  },
  {
    key: "places",
    label: "Где удобно заниматься",
    type: "chips",
    options: ["Дома", "Тренажёрный зал", "Улица / парк", "Бассейн", "Групповые занятия", "Йога / пилатес-студия"],
    wide: true,
  },
  {
    key: "equipment",
    label: "Что есть дома",
    type: "chips",
    options: ["Коврик", "Гантели", "Резинки", "Фитбол", "Скакалка", "Турник", "Велотренажёр", "Ничего"],
    wide: true,
  },
  { key: "likes", label: "Что нравится", type: "text", placeholder: "Например: танцы, плавание, ходьба" },
  { key: "dislikes", label: "Что не нравится", type: "text", placeholder: "Например: бег, прыжки" },
];

export const SPA_FIELDS: FieldDef[] = [
  { key: "period", label: "Период", type: "select", options: ["Неделя", "Месяц"], required: true },
  {
    key: "skin_type",
    label: "Тип кожи лица",
    type: "select",
    options: ["Сухая", "Нормальная", "Комбинированная", "Жирная", "Чувствительная", "Не знаю"],
  },
  { key: "time_per_day", label: "Время на уход в день", type: "select", options: ["5–10 минут", "15–20 минут", "30 минут", "Больше"] },
  {
    key: "skin_concerns",
    label: "Что беспокоит в коже лица",
    type: "chips",
    options: ["Сухость", "Шелушение", "Жирный блеск", "Высыпания", "Расширенные поры", "Пигментация", "Покраснения", "Морщины", "Отёки", "Тусклость"],
    wide: true,
  },
  {
    key: "body_concerns",
    label: "Кожа тела",
    type: "chips",
    options: ["Сухость", "Целлюлит", "Растяжки", "Потеря упругости", "Шероховатость", "Отёки ног"],
    wide: true,
  },
  {
    key: "hair_concerns",
    label: "Волосы и кожа головы",
    type: "chips",
    options: ["Сухие", "Жирнеют", "Выпадают", "Ломкие", "Перхоть", "Окрашенные", "Тонкие"],
    wide: true,
  },
  { key: "budget", label: "Бюджет на уход", type: "select", options: ["Минимальный", "Средний", "Не ограничен"] },
  { key: "salon", label: "Салоны / косметолог", type: "select", options: ["Только дома", "Иногда", "Регулярно"] },
  { key: "home_products", label: "Что уже есть дома", type: "text", placeholder: "Например: крем, сыворотка, скраб", wide: true },
  { key: "allergies", label: "Аллергии и непереносимость", type: "text", placeholder: "Например: эфирные масла, мёд", wide: true },
  { key: "likes", label: "Любимые ароматы и ощущения", type: "text", placeholder: "Например: лаванда, тёплые ванны", wide: true },
];

export const NUTRITION_FIELDS: FieldDef[] = [
  {
    key: "goals",
    label: "Цель",
    type: "chips",
    options: ["Похудеть", "Набрать массу", "Поддерживать вес", "Больше энергии", "Здоровая кожа", "Наладить режим"],
    required: true,
    wide: true,
  },
  {
    key: "diet_type",
    label: "Тип питания",
    type: "select",
    options: ["Ем всё", "Без мяса", "Вегетарианство", "Веганство", "Пост", "Без глютена", "Без лактозы"],
  },
  { key: "meals_per_day", label: "Приёмов пищи в день", type: "select", options: ["2", "3", "3 + перекус", "4–5"] },
  { key: "cooking_time", label: "Время на готовку", type: "select", options: ["До 15 минут", "15–30 минут", "До часа", "Люблю готовить"] },
  { key: "budget", label: "Бюджет на продукты", type: "select", options: ["Экономный", "Средний", "Не ограничен"] },
  { key: "activity", label: "Активность", type: "select", options: ["Сидячая работа", "Умеренная", "Много движения", "Тренировки"] },
  {
    key: "shops",
    label: "Где покупаете продукты",
    type: "chips",
    options: ["Супермаркет", "Рынок", "Маленький магазин у дома", "Доставка", "Свой огород"],
    required: true,
    wide: true,
  },
  { key: "excluded", label: "Аллергии и что не едите", type: "text", placeholder: "Например: орехи, рыба, кинза", wide: true },
  { key: "likes", label: "Любимые продукты и блюда", type: "text", placeholder: "Например: гречка, курица, ягоды", wide: true },
];

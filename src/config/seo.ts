/**
 * Заголовок и описание для поисковиков — по адресу страницы.
 * Правим здесь — меняется на всём сайте.
 */

export interface PageSeo {
  title: string;
  description: string;
}

export const DEFAULT_SEO: PageSeo = {
  title: "StyleSelect — виртуальная примерочная и подбор образа онлайн",
  description:
    "Виртуальная примерочная онлайн, определение цветотипа и типажа по фото, стилевой анализ внешности, подбор образов, ароматов и подарков",
};

export const PAGE_SEO: Record<string, PageSeo> = {
  "/": DEFAULT_SEO,
  "/virtualfitting": {
    title: "Виртуальная примерочная одежды онлайн по фото — StyleSelect",
    description:
      "Примерьте одежду онлайн по своему фото: загрузите снимок и посмотрите, как на вас сидит вещь. Быстрая виртуальная примерка с помощью ИИ",
  },
  "/freegeneration": {
    title: "Генерация изображений по описанию — StyleSelect",
    description:
      "Создавайте изображения по текстовому описанию: образы, фоны и идеи для съёмок. Готовый результат за минуту",
  },
  "/colortype": {
    title: "Определение цветотипа внешности по фото онлайн — StyleSelect",
    description:
      "Узнайте свой цветотип по фото: персональная палитра оттенков, которые подчёркивают вашу природную красоту, и советы по гардеробу",
  },
  "/style-analysis": {
    title: "Стилевой анализ внешности по фото — StyleSelect",
    description:
      "Разбор внешности по фото: стиль, палитра, готовые образы и рекомендации. Также подбор причёски, макияжа и очков",
  },
  "/outfit-selection": {
    title: "Подбор образов и капсульного гардероба онлайн — StyleSelect",
    description:
      "Соберём образы под вашу фигуру, цветотип и повод. Капсульный гардероб и готовые сочетания вещей",
  },
  "/wedding-selection": {
    title: "Свадебный образ невесты онлайн — StyleSelect",
    description:
      "Подбор свадебного образа по фото: платье, причёска, украшения и палитра, которые подойдут именно вам",
  },
  "/gift-selection": {
    title: "Подбор подарков онлайн — StyleSelect",
    description:
      "Поможем выбрать подарок под человека, повод и бюджет. Персональные идеи вместо долгих поисков",
  },
  "/perfume-selection": {
    title: "Подбор аромата и духов онлайн — StyleSelect",
    description:
      "Персональный подбор парфюма: аромат под ваш характер, стиль и повод, с описанием нот и готовыми вариантами",
  },
  "/kibbe-test": {
    title: "Типаж по системе Кибби — бесплатный тест онлайн — StyleSelect",
    description:
      "Определите свой типаж по системе Дэвида Кибби: бесплатный тест по ответам или разбор по фото, с рекомендациями по одежде",
  },
  "/archetype-test": {
    title: "Архетип по Юнгу — тест онлайн — StyleSelect",
    description:
      "Узнайте свой архетип личности по Юнгу и то, как он проявляется в вашем стиле, образе и выборе вещей",
  },
  "/divination": {
    title: "Гадания на картах Таро и Ленорман онлайн — StyleSelect",
    description:
      "Онлайн-расклады на картах Таро и Ленорман с подробным толкованием, а также диалог с картами: вопрос, ответ и уточнения",
  },
  "/knowledge": {
    title: "База знаний о стиле, цветотипе и моде — StyleSelect",
    description:
      "Статьи, инструкции и советы о стиле, цветотипе, типажах и уходе за образом. Полезные материалы от StyleSelect",
  },
  "/payment": {
    title: "Оплата и тарифы — StyleSelect",
    description:
      "Информация об оплате услуг StyleSelect: способы пополнения баланса, стоимость сервисов и возврат средств",
  },
  "/contacts": {
    title: "Контакты — StyleSelect",
    description:
      "Свяжитесь со StyleSelect: почта для обращений, сообщества в Telegram и ВКонтакте, реквизиты",
  },
  "/offer": {
    title: "Публичная оферта — StyleSelect",
    description: "Условия оказания услуг сервиса StyleSelect: публичная оферта",
  },
  "/privacy": {
    title: "Политика конфиденциальности — StyleSelect",
    description:
      "Как StyleSelect собирает, хранит и защищает данные пользователей",
  },
  "/personal-data": {
    title: "Обработка персональных данных — StyleSelect",
    description:
      "Согласие и правила обработки персональных данных в сервисе StyleSelect",
  },
  "/login": {
    title: "Вход в личный кабинет — StyleSelect",
    description: "Войдите в StyleSelect, чтобы продолжить работу с сервисами",
  },
  "/register": {
    title: "Регистрация — StyleSelect",
    description:
      "Создайте аккаунт StyleSelect: виртуальная примерка, цветотип, подбор образов и другие сервисы",
  },
};

/** Личный кабинет и админка от поисковиков закрыты — общие тексты */
export const SECTION_SEO: { prefix: string; seo: PageSeo }[] = [
  {
    prefix: "/profile",
    seo: {
      title: "Личный кабинет — StyleSelect",
      description: "Ваши образы, история сервисов и баланс в личном кабинете",
    },
  },
  {
    prefix: "/vf-console",
    seo: { title: "Панель управления", description: "" },
  },
];

export const getPageSeo = (pathname: string): PageSeo => {
  const exact = PAGE_SEO[pathname];
  if (exact) return exact;
  const section = SECTION_SEO.find((s) => pathname.startsWith(s.prefix));
  if (section) return section.seo;
  return DEFAULT_SEO;
};

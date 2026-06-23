import { STYLE_ANALYSIS_COST } from "@/config/prices";

export const START_API =
  "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
export const STATUS_API =
  "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";

export const COST = STYLE_ANALYSIS_COST;
export const POLLING_INTERVAL = 8000;
export const TIMEOUT_DURATION = 240000;

export type Service = {
  id: string;
  name: string;
  icon: string;
  available: boolean;
  testLink?: boolean;
  testPath?: string;
  testInfo?: string;
};

export const SERVICES: Service[] = [
  { id: "style", name: "Стиль одежды", icon: "Shirt", available: true },
  { id: "hairstyle", name: "Причёски", icon: "Scissors", available: false },
  { id: "makeup", name: "Макияж", icon: "Sparkles", available: false },
  { id: "face", name: "Анализ лица", icon: "ScanFace", available: false },
  { id: "colortype", name: "Цветотип", icon: "Palette", available: false },
  {
    id: "archetype",
    name: "Архетип по Юнгу",
    icon: "Brain",
    available: true,
    testLink: true,
    testPath: "/archetype-test",
    testInfo:
      "Определение архетипа по фото пока в разработке. Но вы уже можете бесплатно пройти тест из 36 вопросов и узнать свой ведущий архетип из 12 по системе Карла Юнга.",
  },
  {
    id: "kibbe",
    name: "Типаж по Кибби",
    icon: "Ruler",
    available: true,
    testLink: true,
    testPath: "/kibbe-test",
    testInfo:
      "Определение типажа по Кибби по фото пока в разработке. Но вы уже можете бесплатно пройти тест и узнать свой типаж из 10 по системе Дэвида Кибби.",
  },
];

import type { ReportConfig } from "@/components/BeautyAnalysisReport";

export const GLASSES_REPORT: ReportConfig = {
  header: "Подбор очков по фото",
  titleField: "face_shape",
  looksField: "glasses_looks",
  looksTitle: "Ваши очки",
  looksIcon: "Glasses",
  fileName: "glasses-analysis",
  blocks: [
    { kind: "text", field: "face_analysis", icon: "ScanFace", title: "Форма лица" },
    { kind: "text", field: "color_analysis", icon: "Palette", title: "Ваш колорит" },
    { kind: "nameReason", field: "best_shapes", icon: "Check", title: "Подходящие формы оправ" },
    { kind: "nameReason", field: "avoid_shapes", icon: "X", title: "Чего избегать" },
    { kind: "colors", field: "frame_colors", icon: "Palette", title: "Цвета оправ" },
    { kind: "nameReason", field: "materials", icon: "Layers", title: "Материалы оправ" },
    { kind: "list", field: "sizing_tips", icon: "Ruler", title: "Как подобрать размер" },
    { kind: "text", field: "sunglasses_tip", icon: "Sun", title: "Солнцезащитные очки" },
    { kind: "list", field: "tips", icon: "Lightbulb", title: "Советы оптика" },
  ],
};

export const MAKEUP_REPORT: ReportConfig = {
  header: "Подбор макияжа по фото",
  titleField: "skin_type",
  looksField: "makeup_looks",
  looksTitle: "Ваши образы",
  looksIcon: "Sparkles",
  fileName: "makeup-analysis",
  blocks: [
    { kind: "text", field: "skin_analysis", icon: "ScanFace", title: "Ваша кожа" },
    { kind: "text", field: "color_analysis", icon: "Palette", title: "Ваш колорит" },
    { kind: "text", field: "features_analysis", icon: "Eye", title: "Черты лица" },
    { kind: "nameReason", field: "textures_yes", icon: "Check", title: "Подходящие текстуры" },
    { kind: "nameReason", field: "textures_no", icon: "X", title: "Что вам не подойдёт" },
    { kind: "nameReason", field: "base_routine", icon: "Droplet", title: "База и подготовка" },
    { kind: "colors", field: "palette_eyes", icon: "Eye", title: "Палитра для глаз" },
    { kind: "colors", field: "palette_lips", icon: "Smile", title: "Палитра для губ" },
    { kind: "colors", field: "palette_blush", icon: "Heart", title: "Румяна" },
    { kind: "colors", field: "palette_avoid", icon: "X", title: "Оттенки, которых избегать" },
    { kind: "text", field: "brows", icon: "Minus", title: "Брови" },
    { kind: "nameReason", field: "techniques", icon: "Brush", title: "Техники нанесения" },
    { kind: "list", field: "tips", icon: "Lightbulb", title: "Советы визажиста" },
  ],
};

export const HAIRSTYLE_REPORT: ReportConfig = {
  header: "Подбор причёски по фото",
  titleField: "face_shape",
  subtitleField: "hair_type",
  looksField: "hair_looks",
  looksTitle: "Ваши причёски",
  looksIcon: "Scissors",
  fileName: "hairstyle-analysis",
  blocks: [
    { kind: "text", field: "face_analysis", icon: "ScanFace", title: "Форма лица" },
    { kind: "text", field: "hair_analysis", icon: "Wind", title: "Ваши волосы" },
    { kind: "nameReason", field: "best_cuts", icon: "Check", title: "Подходящие стрижки" },
    { kind: "nameReason", field: "avoid_cuts", icon: "X", title: "Чего избегать" },
    { kind: "text", field: "bangs", icon: "Minus", title: "Чёлка" },
    { kind: "text", field: "length_advice", icon: "Ruler", title: "Оптимальная длина" },
    { kind: "colors", field: "hair_colors", icon: "Palette", title: "Оттенки окрашивания" },
    { kind: "colors", field: "colors_avoid", icon: "X", title: "Оттенки, которых избегать" },
    { kind: "nameReason", field: "coloring_techniques", icon: "Brush", title: "Техники окрашивания" },
    { kind: "nameReason", field: "styling_tips", icon: "Wand", title: "Укладка" },
    { kind: "nameReason", field: "care", icon: "Droplet", title: "Уход за волосами" },
    { kind: "list", field: "tips", icon: "Lightbulb", title: "Советы стилиста" },
  ],
};

export const KIBBE_REPORT: ReportConfig = {
  header: "Типаж по системе Кибби",
  titleField: "kibbe_type",
  subtitleField: "essence",
  looksField: "kibbe_looks",
  looksTitle: "Ваши образы",
  looksIcon: "Sparkles",
  fileName: "kibbe-analysis",
  blocks: [
    { kind: "text", field: "confidence", icon: "Info", title: "Точность определения" },
    { kind: "text", field: "bone_structure", icon: "Bone", title: "Ваш костяк" },
    { kind: "text", field: "vertical_flesh", icon: "Ruler", title: "Вертикаль и линии тела" },
    { kind: "text", field: "facial_features", icon: "ScanFace", title: "Черты лица" },
    { kind: "text", field: "yin_yang", icon: "Scale", title: "Баланс инь и ян" },
    { kind: "nameReason", field: "best_lines", icon: "Check", title: "Выигрышные линии" },
    { kind: "nameReason", field: "avoid_lines", icon: "X", title: "Что ломает образ" },
    { kind: "nameReason", field: "fabrics", icon: "Layers", title: "Подходящие ткани" },
    { kind: "nameReason", field: "key_items", icon: "ShoppingBag", title: "Ключевые вещи" },
    { kind: "nameReason", field: "accessories", icon: "Gem", title: "Аксессуары" },
    { kind: "text", field: "hair_makeup", icon: "Brush", title: "Причёска и макияж" },
    { kind: "list", field: "celebrities", icon: "Star", title: "Знаменитости вашего типажа" },
    { kind: "list", field: "tips", icon: "Lightbulb", title: "Советы по гардеробу" },
  ],
};

export const BEAUTY_REPORTS: Record<string, ReportConfig> = {
  glasses: GLASSES_REPORT,
  makeup: MAKEUP_REPORT,
  hairstyle: HAIRSTYLE_REPORT,
  kibbe: KIBBE_REPORT,
};

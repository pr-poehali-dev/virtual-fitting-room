/**
 * Тема раздела гаданий — единая точка правды по оформлению.
 * Меняем цвета/скругления здесь — меняется весь раздел.
 * Шрифты используем те, что уже есть в проекте (Cormorant + Montserrat).
 * ВАЖНО: тема применяется ТОЛЬКО внутри контентного блока страницы,
 * шапка сайта, боковое меню и футер не затрагиваются.
 */

export const divTheme = {
  // Фон основного полотна раздела
  surface:
    "bg-gradient-to-b from-[#1a1030] via-[#241845] to-[#1a1030] text-[#e8e0f0]",
  // Панель/карточка внутри полотна
  panel: "bg-white/5 backdrop-blur-sm ring-1 ring-[#c9a84c]/25 rounded-2xl",
  panelSoft: "bg-white/[0.03] ring-1 ring-white/10 rounded-xl",

  // Текст
  title: "font-serif text-[#f3ecff]",
  text: "text-[#e8e0f0]",
  muted: "text-[#9888b8]",
  accentText: "text-[#c9a84c]",

  // Акцент (золото)
  accent: "#c9a84c",
  accentSoft: "bg-[#c9a84c]/12 ring-1 ring-[#c9a84c]/35",

  // Кнопки
  btnPrimary:
    "bg-gradient-to-r from-[#c9a84c] to-[#e8c252] text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a] font-semibold shadow-lg shadow-black/25",
  btnGhost:
    "bg-white/5 text-[#e8e0f0] ring-1 ring-white/15 hover:bg-white/10",

  // Выбираемая карточка-вариант
  option:
    "rounded-xl p-4 text-left transition-all ring-1 ring-white/12 bg-white/[0.04] hover:bg-white/[0.08] hover:ring-[#c9a84c]/40",
  optionActive:
    "rounded-xl p-4 text-left transition-all ring-2 ring-[#c9a84c] bg-[#c9a84c]/15 shadow-lg shadow-[#c9a84c]/10",
} as const;

export type DivTheme = typeof divTheme;

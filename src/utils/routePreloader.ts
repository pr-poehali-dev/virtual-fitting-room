/**
 * Фоновая предзагрузка страниц по важности.
 *
 * Страницы грузятся волнами, пока пользователь читает текущую.
 * Загрузка идёт в простое браузера и полностью прозрачна для человека:
 * если он кликает раньше, его переход обслуживается в первую очередь.
 *
 * Предзагрузка НЕ выполняется на медленном соединении и при включённом
 * режиме экономии трафика — чтобы не расходовать чужой мобильный интернет.
 */

type Loader = () => Promise<unknown>;

// Волна 1 — сервисы: основная ценность продукта
const WAVE_SERVICES: Loader[] = [
  () => import("@/pages/ReplicateTryOn"),
  () => import("@/pages/FreeGeneration"),
  () => import("@/pages/ColorType"),
  () => import("@/pages/StyleAnalysis"),
  () => import("@/pages/OutfitSelection"),
  () => import("@/pages/AiEditor"),
];

// Волна 2 — кошелёк, кабинет и вход
const WAVE_ACCOUNT: Loader[] = [
  () => import("@/pages/ProfileWallet"),
  () => import("@/pages/ProfileDashboard"),
  () => import("@/pages/Payment"),
  () => import("@/pages/Login"),
  () => import("@/pages/Register"),
];

// Волна 3 — сохранённое пользователя
const WAVE_SAVED: Loader[] = [
  () => import("@/pages/ProfileLookbooks"),
  () => import("@/pages/ProfileModels"),
  () => import("@/pages/ProfileOutfitProfiles"),
  () => import("@/pages/PalettePage"),
  () => import("@/pages/ColorGuideDetail"),
];

// Волна 4 — бесплатные тесты и база знаний
const WAVE_TESTS: Loader[] = [
  () => import("@/pages/KibbeTest"),
  () => import("@/pages/KibbeResultDetail"),
  () => import("@/pages/ArchetypeTest"),
  () => import("@/pages/ArchetypeResultDetail"),
  () => import("@/pages/LenormandDivination"),
  () => import("@/pages/Knowledge"),
  () => import("@/pages/KnowledgePost"),
];

// Волна 5 — истории, посещают редко
const WAVE_HISTORY: Loader[] = [
  () => import("@/pages/ProfileHistory"),
  () => import("@/pages/ProfileHistoryColortypes"),
  () => import("@/pages/ProfileHistoryColorGuide"),
  () => import("@/pages/ProfileHistoryFreegen"),
  () => import("@/pages/ProfileHistoryKibbe"),
  () => import("@/pages/ProfileHistoryArchetype"),
];

const WAVES: Loader[][] = [
  WAVE_SERVICES,
  WAVE_ACCOUNT,
  WAVE_SAVED,
  WAVE_TESTS,
  WAVE_HISTORY,
];

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/** Медленный интернет или режим экономии трафика — предзагрузку пропускаем. */
function shouldSkipPreload(): boolean {
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!conn) return false;
  if (conn.saveData) return true;
  const slow = ["slow-2g", "2g", "3g"];
  return !!conn.effectiveType && slow.includes(conn.effectiveType);
}

/** Выполнить работу в простое браузера, не мешая отрисовке. */
function whenIdle(fn: () => void, timeout = 2000): void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(fn, { timeout });
  } else {
    window.setTimeout(fn, 200);
  }
}

let started = false;

/**
 * Запускает фоновую предзагрузку страниц волнами.
 * Вызывать один раз после первой отрисовки приложения.
 */
export function startRoutePreload(initialDelay = 2000): void {
  if (started) return;
  started = true;

  if (shouldSkipPreload()) return;

  const runWave = (index: number): void => {
    if (index >= WAVES.length) return;
    whenIdle(() => {
      Promise.allSettled(WAVES[index].map((load) => load())).finally(() => {
        window.setTimeout(() => runWave(index + 1), 400);
      });
    });
  };

  window.setTimeout(() => runWave(0), initialDelay);
}

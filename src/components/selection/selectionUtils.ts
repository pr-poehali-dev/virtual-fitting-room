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

export const ZODIAC_SIGNS = [
  "Овен",
  "Телец",
  "Близнецы",
  "Рак",
  "Лев",
  "Дева",
  "Весы",
  "Скорпион",
  "Стрелец",
  "Козерог",
  "Водолей",
  "Рыбы",
];

export const SEASONS = ["Весна", "Лето", "Осень", "Зима"];

export const MAX_ARCHETYPES = 4;
export const MAX_COLORTYPES = 2;

/** Добавляет к выбранным тегам значения, введённые вручную через запятую. */
export function mergeCustom(list: string[], custom: string): string[] {
  const extra = custom
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...list, ...extra];
}

/** Три коротких ноты — сигнал, что результат готов. */
export function playReadySound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [880, 1108.73, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.16;
      const end = start + 0.22;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // звук не критичен — молча игнорируем
  }
}

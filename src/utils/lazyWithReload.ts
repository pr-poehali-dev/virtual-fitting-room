/**
 * Защита от «пустой страницы» после обновления сайта.
 *
 * Страницы грузятся отдельными файлами, имена которых меняются при каждом
 * обновлении. Если у человека открыта старая вкладка, она просит файл со
 * старым именем — его на сервере уже нет (404), и вместо страницы пустота.
 * Лечится обычным F5, поэтому делаем этот F5 за пользователя.
 */

const RELOAD_FLAG = 'chunk-reload-at';
// Окно, внутри которого повторная ошибка считается зацикливанием
const RELOAD_WINDOW_MS = 15000;

function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(
    message,
  );
}

/**
 * Разрешаем перезагрузку только один раз подряд: если после неё ошибка
 * повторилась, значит дело не в обновлении сайта — крутить бесконечно нельзя.
 */
function canReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (last && Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Вызывается после успешной загрузки: цепочка прервалась, счётчик сбрасываем */
export function clearReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* приватный режим — не критично */
  }
}

export { isStaleChunkError, canReload };
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { divTheme } from "./theme";
import DialogReader from "./DialogReader";

const DIVINATION_DIALOG =
  "https://functions.poehali.dev/336075f7-e6e8-4cd9-bfd5-80e6e23e187a";

export interface SavedDialog {
  dialog_id: string;
  system: string;
  spread: string;
  status: string;
  steps_count: number;
  deck_mode: string;
  cards_per_step: number;
  created_at: string | null;
  first_question: string;
  last_question: string;
  step_price: number;
}

interface SavedDialogsProps {
  /** Сигнал перезагрузить список (меняется после действий с диалогом) */
  reloadKey?: number;
  onContinue: (dialog: SavedDialog) => void;
}

export const dialogApi = async (payload: Record<string, unknown>) => {
  const token = localStorage.getItem("session_token");
  const res = await fetch(DIVINATION_DIALOG, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Session-Token": token } : {}),
    },
    body: JSON.stringify(payload),
  });
  return { res, data: await res.json() };
};

/**
 * Телефон или планшет? На компьютере системное «Поделиться» открывает
 * окно Windows с плитками приложений — оно пугает и почти бесполезно,
 * поэтому там просто сохраняем файл или копируем текст.
 */
export const isMobileDevice = () =>
  typeof navigator !== "undefined" &&
  (navigator.maxTouchPoints || 0) > 0 &&
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

/** Забирает беседу с сервера и собирает её в готовый текст. */
const buildDialogText = async (dialogId: string) => {
  const { res, data } = await dialogApi({
    action: "history",
    dialog_id: dialogId,
  });
  if (!res.ok) {
    toast.error(data.error || "Не удалось получить беседу");
    return null;
  }

  const lines: string[] = [
    "Диалог-гадание на картах",
    `Колода: ${data.system === "tarot" ? "Таро" : "Ленорман"}`,
    `Вопросов: ${data.steps_count}`,
    "",
    "========================================",
    "",
  ];

  (data.steps || []).forEach(
    (s: { step_no: number; question: string; cards: string[]; answer: string }) => {
      lines.push(`ВОПРОС ${s.step_no}: ${s.question}`);
      lines.push(`Выпали карты: ${(s.cards || []).join(", ") || "—"}`);
      lines.push("");
      lines.push(s.answer || "");
      lines.push("");
      lines.push("----------------------------------------");
      lines.push("");
    },
  );

  lines.push("fitting-room.ru");

  const deckName = data.system === "tarot" ? "Таро" : "Ленорман";
  const stamp = new Date().toLocaleDateString("ru-RU").replace(/\./g, "-");
  return {
    text: lines.join("\r\n"),
    fileName: `Гадание-${deckName}-${stamp}.txt`,
  };
};

/** Собирает беседу в текстовый файл и скачивает. */
export const downloadDialogText = async (dialogId: string) => {
  const built = await buildDialogText(dialogId);
  if (!built) return;

  // \uFEFF (BOM) — метка UTF-8 в начале файла. Без неё «Блокнот» на Android
  // и Windows считает текст кириллицей-1251 и показывает кракозябры.
  const blob = new Blob(["\uFEFF" + built.text], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = built.fileName;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Сохранено в «Загрузки»: ${a.download}`);
};

/**
 * Отправляет беседу ТЕКСТОМ: на телефоне открывается системное «Поделиться»
 * и текст уходит прямо в мессенджер, на компьютере — копируется в буфер.
 */
export const shareDialogText = async (dialogId: string) => {
  const built = await buildDialogText(dialogId);
  if (!built) return;

  try {
    if (isMobileDevice() && navigator.share) {
      await navigator.share({ title: "Моё гадание", text: built.text });
      return;
    }
    await navigator.clipboard.writeText(built.text);
    toast.success("Беседа скопирована — вставьте её в сообщение");
  } catch (e) {
    // Человек мог сам закрыть окно «Поделиться» — это не ошибка
    if ((e as Error)?.name === "AbortError") return;
    toast.error("Не удалось поделиться беседой");
  }
};

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

/**
 * «Сохранено у вас» для вкладки Диалоги: список бесед,
 * которые можно продолжить, скачать или удалить.
 */
const SavedDialogs = ({ reloadKey = 0, onContinue }: SavedDialogsProps) => {
  const [items, setItems] = useState<SavedDialog[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Беседа, открытая на чтение (окно поверх страницы)
  const [readId, setReadId] = useState<string | null>(null);
  // Список свёрнут: при заходе виден только заголовок со стрелкой
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { res, data } = await dialogApi({ action: "list" });
      if (res.ok) setItems(data.items || []);
    } catch {
      /* тихо */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  // Есть незакрытая беседа — раскрываем сразу: её ждут, чтобы продолжить
  useEffect(() => {
    if (items.some((i) => i.status === "active")) setOpen(true);
  }, [items]);

  const remove = async (id: string) => {
    const { res, data } = await dialogApi({ action: "delete", dialog_id: id });
    if (!res.ok) {
      toast.error(data.error || "Не удалось удалить");
      return;
    }
    setConfirmId(null);
    setItems((prev) => prev.filter((i) => i.dialog_id !== id));
    toast.success("Диалог удалён");
  };

  if (loading || items.length === 0) return null;

  return (
    <div className={`${divTheme.panel} mb-6`}>
      {/* Список сворачиваем: бесед бывает много, и они занимали весь экран */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-5 text-left"
      >
        <span className="flex items-center gap-2">
          <Icon name="Bookmark" size={18} className="text-[#c9a84c]" />
          <h2 className={`font-serif text-lg ${divTheme.title}`}>
            Сохранённые диалоги
          </h2>
          <span className={`text-sm ${divTheme.muted}`}>({items.length})</span>
        </span>
        <Icon
          name={open ? "ChevronUp" : "ChevronDown"}
          size={20}
          className="shrink-0 text-[#9888b8]"
        />
      </button>

      {open && (
      <div className="space-y-3 px-5 pb-5">
        {items.map((d) => {
          const active = d.status === "active";
          return (
            <div
              key={d.dialog_id}
              className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium text-[#f3ecff]">
                  {d.system === "tarot" ? "Таро" : "Ленорман"} · до{" "}
                  {d.cards_per_step}{" "}
                  {d.cards_per_step === 1 ? "карты" : "карт"} на вопрос
                </span>
                {active ? (
                  <span className="rounded-full bg-[#4caf50]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8fd694] ring-1 ring-[#4caf50]/40">
                    Можно продолжить
                  </span>
                ) : (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9888b8]">
                    Закрыт
                  </span>
                )}
                <span className={`text-xs ${divTheme.muted}`}>
                  {formatDate(d.created_at)} · вопросов: {d.steps_count}
                </span>
              </div>

              {d.first_question && (
                <p className="mb-1 text-sm text-[#c9bfe0]">
                  <span className={divTheme.muted}>Начало: </span>
                  {d.first_question}
                </p>
              )}
              {d.last_question && d.last_question !== d.first_question && (
                <p className="mb-2 text-sm text-[#c9bfe0]">
                  <span className={divTheme.muted}>Последний вопрос: </span>
                  {d.last_question}
                </p>
              )}

              {confirmId === d.dialog_id ? (
                <div className="mt-3 rounded-lg bg-[#e74c3c]/10 p-3 ring-1 ring-[#e74c3c]/30">
                  <p className="mb-2 text-sm text-[#f3d4d0]">
                    Удалить эту беседу? Вернуть её будет нельзя.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => remove(d.dialog_id)}
                      className="bg-[#e74c3c] font-semibold text-white hover:bg-[#c0392b]"
                    >
                      Да, удалить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmId(null)}
                      className={divTheme.btnGhost}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {active && (
                    <Button
                      size="sm"
                      onClick={() => onContinue(d)}
                      className={divTheme.btnPrimary}
                    >
                      <Icon name="Play" size={15} className="mr-1.5" />
                      Вернуться к диалогу
                    </Button>
                  )}
                  {/* Закрытую беседу продолжить нельзя, но перечитать — можно */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReadId(d.dialog_id)}
                    className={active ? divTheme.btnGhost : divTheme.btnPrimary}
                  >
                    <Icon name="BookOpen" size={15} className="mr-1.5" />
                    Читать беседу
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => shareDialogText(d.dialog_id)}
                    className={divTheme.btnGhost}
                  >
                    <Icon
                      name={isMobileDevice() ? "Share2" : "Copy"}
                      size={15}
                      className="mr-1.5"
                    />
                    {isMobileDevice() ? "Поделиться" : "Скопировать"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => downloadDialogText(d.dialog_id)}
                    className={divTheme.btnGhost}
                  >
                    <Icon name="Download" size={15} className="mr-1.5" />
                    Скачать беседу
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmId(d.dialog_id)}
                    className="bg-white/5 text-[#e0a8a0] ring-1 ring-white/15 hover:bg-[#e74c3c]/15 hover:text-[#f3d4d0]"
                  >
                    <Icon name="Trash2" size={15} className="mr-1.5" />
                    Удалить
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {readId && (
        <DialogReader dialogId={readId} onClose={() => setReadId(null)} />
      )}
    </div>
  );
};

export default SavedDialogs;
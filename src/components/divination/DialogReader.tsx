import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { divTheme } from "./theme";
import {
  dialogApi,
  downloadDialogText,
  isMobileDevice,
  shareDialogText,
} from "./SavedDialogs";
import ReadAloud from "./ReadAloud";

interface ReadStep {
  step_no: number;
  question: string;
  cards: string[];
  answer: string;
}

interface DialogReaderProps {
  dialogId: string;
  onClose: () => void;
}

/**
 * Окно «только чтение»: показывает всю беседу — вопросы, выпавшие карты
 * и толкования. Нужно для закрытых диалогов, которые нельзя продолжить,
 * но хочется перечитать, не скачивая файл.
 */
const DialogReader = ({ dialogId, onClose }: DialogReaderProps) => {
  const [steps, setSteps] = useState<ReadStep[]>([]);
  const [system, setSystem] = useState("lenormand");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { res, data } = await dialogApi({
        action: "history",
        dialog_id: dialogId,
      });
      if (cancelled) return;
      if (!res.ok) {
        toast.error(data.error || "Не удалось открыть беседу");
        onClose();
        return;
      }
      setSteps(data.steps || []);
      setSystem(data.system || "lenormand");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogId, onClose]);

  // Esc закрывает окно — привычно и быстрее, чем целиться в крестик
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Пока читаем беседу, страница под окном не должна ехать
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Рисуем окно в корне страницы: внутри блока с размытием фона
  // оно «запирается» и получает собственный маленький скролл
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/80 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-[#1a1030] shadow-2xl ring-1 ring-[#c9a84c]/30 sm:h-auto sm:max-h-[88vh] sm:max-w-3xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка закреплена: заголовок и крестик всегда на виду */}
        <div className="flex items-start justify-between gap-3 border-b border-[#c9a84c]/20 bg-[#241845] p-5 sm:p-6">
          <div>
            <h3 className="font-serif text-xl text-[#f3ecff]">
              Беседа с картами
            </h3>
            <p className={`text-sm ${divTheme.muted}`}>
              {system === "tarot" ? "Таро" : "Ленорман"} · вопросов:{" "}
              {steps.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="shrink-0 rounded-lg p-1.5 text-[#c9bfe0] transition hover:bg-white/10 hover:text-white"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Прокручивается только текст беседы, шапка и кнопки на месте */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        {loading ? (
          <p className={`py-8 text-center text-sm ${divTheme.muted}`}>
            Открываю беседу…
          </p>
        ) : (
          <div className="space-y-4">
            {steps.map((s) => (
              <div
                key={s.step_no}
                className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10"
              >
                <div className="mb-2 flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c9a84c]/20 text-xs font-semibold text-[#c9a84c]">
                    {s.step_no}
                  </span>
                  <p className="font-medium text-[#f3ecff]">{s.question}</p>
                </div>
                {(s.cards || []).length > 0 && (
                  <p className="mb-2 text-sm text-[#c9a84c]">
                    Выпали карты: {s.cards.join(", ")}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#e8e0f0]">
                  {s.answer}
                </p>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Кнопки закреплены внизу — не надо докручивать до конца беседы */}
        <div className="flex flex-wrap gap-2 border-t border-[#c9a84c]/20 bg-[#241845] p-4 sm:p-5">
          {/* Слушать всю беседу подряд: вопрос — ответ — следующий вопрос */}
          {steps.length > 0 && (
            <ReadAloud
              compact
              text={steps
                .map(
                  (s) =>
                    `Вопрос ${s.step_no}. ${s.question}. Ответ. ${s.answer}`,
                )
                .join(" ")}
            />
          )}
          <Button
            size="sm"
            onClick={() => shareDialogText(dialogId)}
            className={divTheme.btnPrimary}
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
            onClick={() => downloadDialogText(dialogId)}
            className={divTheme.btnGhost}
          >
            <Icon name="Download" size={15} className="mr-1.5" />
            Скачать беседу
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className={divTheme.btnGhost}
          >
            Закрыть
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DialogReader;
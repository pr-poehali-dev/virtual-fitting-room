import { useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";

interface HintPopoverProps {
  /** Заголовок окна подсказки */
  title: string;
  /** Текст подсказки */
  text: string;
  /** Подпись для читалок */
  label?: string;
}

/**
 * Значок «?» рядом с заголовком: по клику открывает окно с пояснением.
 * Нужен, чтобы длинные подсказки не занимали место на экране.
 */
const HintPopover = ({
  title,
  text,
  label = "Показать подсказку",
}: HintPopoverProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#c9a84c]/80 transition hover:text-[#c9a84c]"
      >
        <Icon name="CircleHelp" size={18} />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-[#241845] p-5 shadow-2xl ring-1 ring-[#c9a84c]/30"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h4 className="font-serif text-lg text-[#f3ecff]">{title}</h4>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="shrink-0 rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon name="X" size={18} />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-[#e8e0f0]">{text}</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default HintPopover;

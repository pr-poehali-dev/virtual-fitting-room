import Icon from "@/components/ui/icon";
import { divTheme } from "./theme";
import ReadAloud from "./ReadAloud";
import ReadingText from "./ReadingText";
import type { DialogStep } from "./dialogChatTypes";

interface DialogStepsListProps {
  steps: DialogStep[];
  collapsed: Record<number, boolean>;
  setCollapsed: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  stepRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  getCardImage: (name: string) => string | undefined;
}

/** Лента заданных вопросов: карты и ответ гадалки по каждому шагу. */
const DialogStepsList = ({
  steps,
  collapsed,
  setCollapsed,
  stepRefs,
  getCardImage,
}: DialogStepsListProps) => (
  <>
    {steps.map((s) => {
      const isOpen = !collapsed[s.step_no];
      return (
        <div
          key={s.step_no}
          ref={(el) => {
            stepRefs.current[s.step_no] = el;
          }}
          className={`${divTheme.panel} scroll-mt-20 p-4 sm:p-5`}
        >
          {/* Клик по вопросу разворачивает и сворачивает ответ */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => ({ ...c, [s.step_no]: isOpen }))}
            aria-expanded={isOpen}
            className="mb-3 flex w-full items-start gap-2 text-left"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c9a84c]/20 text-xs font-semibold text-[#c9a84c]">
              {s.step_no}
            </span>
            <p className="flex-1 font-medium text-[#f3ecff]">{s.question}</p>
            <Icon
              name="ChevronDown"
              size={18}
              className={`mt-0.5 shrink-0 text-[#c9a84c] transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <div className="mb-3 flex flex-wrap gap-2">
            {s.cards.map((c, i) => {
              const img = getCardImage(c);
              return (
                <div
                  key={`${c}-${i}`}
                  className="rounded-lg bg-white/[0.06] p-1.5 text-center ring-1 ring-[#c9a84c]/25"
                >
                  {img && (
                    <img
                      src={img}
                      alt={c}
                      className="mx-auto h-[86px] w-[56px] rounded object-contain sm:h-[112px] sm:w-[72px]"
                      loading="lazy"
                    />
                  )}
                  <span className="mt-1 block text-[11px] text-[#c9a84c]">
                    {c}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Свёрнутым остаётся только ответ: вопрос и карты видны всегда */}
          {isOpen && (
            <>
              {/* Кнопка над текстом: длинный ответ, и докручивать до низа
                  ради «Слушать» неудобно */}
              {s.answer && (
                <div className="mb-3">
                  <ReadAloud text={s.answer} compact />
                </div>
              )}

              {/* Ответ читают вдумчиво — тёплый пергамент, как в раскладах */}
              <ReadingText text={s.answer} compact />
              {s.answer && (
                <div className="mt-3">
                  <ReadAloud text={s.answer} compact />
                </div>
              )}
            </>
          )}
        </div>
      );
    })}
  </>
);

export default DialogStepsList;

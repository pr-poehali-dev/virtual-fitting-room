import Icon from "@/components/ui/icon";

interface StepTrailProps {
  /** Подпись слева: «Новый расклад» или «Новый диалог» */
  label: string;
  /** Номера показываемых шагов в порядке прохождения */
  steps: number[];
  /** Текущий шаг */
  current: number;
  /** Переход на пройденный шаг */
  onGo: (step: number) => void;
  disabled?: boolean;
}

/**
 * Путь по звёздам вместо деловой полоски прогресса.
 * Пройденные шаги горят золотом и кликабельны, будущие — приглушены.
 */
const StepTrail = ({
  label,
  steps,
  current,
  onGo,
  disabled = false,
}: StepTrailProps) => {
  const pos = Math.max(0, steps.indexOf(current));

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Icon name="Moon" size={16} className="text-[#e8c252]" />
          <span className="font-serif text-base text-[#e8c252]">{label}</span>
        </span>
        <span className="text-xs text-white/45">
          Шаг {pos + 1} из {steps.length}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => {
          const done = i < pos;
          const active = i === pos;
          return (
            <button
              key={s}
              type="button"
              disabled={disabled || !done}
              onClick={() => done && onGo(s)}
              aria-label={`Шаг ${i + 1}`}
              aria-current={active ? "step" : undefined}
              className={`group flex h-6 flex-1 items-center justify-center ${
                done && !disabled ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <span
                className={`block rounded-full transition-all ${
                  active
                    ? "h-2.5 w-2.5 bg-[#e8c252] shadow-[0_0_10px_3px_rgba(232,194,82,0.5)]"
                    : done
                      ? "h-1.5 w-1.5 bg-[#c9a84c] group-hover:h-2.5 group-hover:w-2.5 group-hover:shadow-[0_0_8px_2px_rgba(201,168,76,0.45)]"
                      : "h-1.5 w-1.5 bg-white/20"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StepTrail;
import Icon from "@/components/ui/icon";
import { divTheme } from "./theme";

export interface OptionItem {
  value: string;
  label: string;
  desc?: string;
  /** Вторая строка под описанием: когда этот вариант уместен */
  hint?: string;
  icon?: string;
  /** Приписка справа, например цена */
  note?: string;
  /** Значок-ярлык рядом с названием, например «Диалог» */
  badge?: string;
}

interface OptionGridProps {
  options: OptionItem[];
  value: string | string[];
  onChange: (value: string) => void;
  /** Несколько значений одновременно (например, сферы жизни) */
  multi?: boolean;
  columns?: 1 | 2 | 3;
  disabled?: boolean;
}

/**
 * Крупные карточки-варианты вместо россыпи мелких кнопок.
 * Используется на всех шагах мастера — единый вид выбора.
 */
const OptionGrid = ({
  options,
  value,
  onChange,
  multi = false,
  columns = 2,
  disabled = false,
}: OptionGridProps) => {
  const selected = Array.isArray(value) ? value : [value];
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`grid gap-2.5 ${colClass}`}>
      {options.map((opt) => {
        const isActive = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`${
              isActive ? divTheme.optionActive : divTheme.option
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <div className="flex items-start gap-3">
              {opt.icon && (
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? "bg-[#c9a84c]/25" : "bg-white/8"
                  }`}
                >
                  <Icon
                    name={opt.icon}
                    size={18}
                    className={isActive ? "text-[#c9a84c]" : "text-[#9888b8]"}
                  />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#f3ecff]">
                    {opt.label}
                  </span>
                  {opt.badge && (
                    <span className="shrink-0 rounded-full bg-[#c9a84c]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#c9a84c] ring-1 ring-[#c9a84c]/40">
                      {opt.badge}
                    </span>
                  )}
                  {multi && isActive && (
                    <Icon
                      name="Check"
                      size={14}
                      className="shrink-0 text-[#c9a84c]"
                    />
                  )}
                </div>
                {opt.desc && (
                  <p className="mt-0.5 text-xs leading-snug text-[#9888b8]">
                    {opt.desc}
                  </p>
                )}
                {opt.hint && (
                  <p className="mt-1 text-xs leading-snug text-[#c9a84c]/75">
                    {opt.hint}
                  </p>
                )}
              </div>
              {opt.note && (
                <span className="shrink-0 text-sm font-semibold text-[#c9a84c]">
                  {opt.note}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default OptionGrid;
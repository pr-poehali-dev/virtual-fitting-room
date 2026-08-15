import { ReactNode } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { divTheme } from "./theme";

interface WizardShellProps {
  titles: string[];
  step: number;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  children: ReactNode;
}

/**
 * Оболочка пошагового мастера: заголовок шага, индикатор прогресса
 * и ОДНА главная кнопка «Далее» внизу — чтобы всегда было понятно,
 * куда нажимать дальше.
 */
const WizardShell = ({
  titles,
  step,
  onBack,
  onNext,
  nextDisabled = false,
  nextLabel,
  children,
}: WizardShellProps) => {
  const total = titles.length;
  const isLast = step === total - 1;

  return (
    <div className={`${divTheme.panel} overflow-hidden`}>
      <div className="p-5 sm:p-6">
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[#9888b8]">
              Шаг {step + 1} из {total}
            </span>
            <span className="text-xs text-[#9888b8]">
              {Math.round(((step + 1) / total) * 100)}%
            </span>
          </div>

          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#e8c252] transition-all duration-300"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>

          <h2 className={`text-xl sm:text-2xl ${divTheme.title}`}>
            {titles[step]}
          </h2>
        </div>

        <div className="min-h-[180px]">{children}</div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={step === 0}
            className={`${divTheme.btnGhost} disabled:opacity-40`}
          >
            <Icon name="ArrowLeft" size={16} className="mr-1.5" />
            Назад
          </Button>

          <Button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`${divTheme.btnPrimary} min-w-[160px] disabled:opacity-50`}
          >
            {nextLabel || (isLast ? "Разложить карты" : "Далее")}
            <Icon name="ArrowRight" size={16} className="ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WizardShell;

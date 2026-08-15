import Icon from "@/components/ui/icon";
import { Card, CardContent } from "@/components/ui/card";

interface SpreadSummaryProps {
  mode: "online" | "real";
  spreadTitle: string;
  modelLabel: string;
  cost: number;
  /** Приписка к цене, например « за вопрос» для диалогов */
  costSuffix?: string;
  genderLabel: string;
  periodLabel: string;
  spheresLabel: string;
  comment: string;
  /** В диалоге сферы и комментарий не спрашиваются — не показываем их */
  hideTopic?: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onClearAll: () => void;
}

/**
 * Шапка «Параметры расклада» с кнопками возврата к настройкам.
 * Показывается и для обычных раскладов, и для диалогов —
 * чтобы всегда было видно выбранное и можно было вернуться назад.
 */
const SpreadSummary = ({
  mode,
  spreadTitle,
  modelLabel,
  cost,
  costSuffix = "",
  genderLabel,
  periodLabel,
  spheresLabel,
  comment,
  hideTopic = false,
  disabled = false,
  onEdit,
  onClearAll,
}: SpreadSummaryProps) => (
  <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-[#2d1b69] via-[#241845] to-[#1a1030] text-white shadow-lg ring-1 ring-[#c9a84c]/25">
    <CardContent className="p-6">
      <h2 className="mb-4 font-serif text-xl text-[#f3ecff]">
        Параметры расклада
      </h2>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[15px] leading-relaxed text-white">
        <span>
          <span className="text-white/60">Способ:</span>{" "}
          {mode === "online" ? "Онлайн-расклад" : "Реальный расклад"}
        </span>
        <span className="text-white/40">·</span>
        <span>
          <span className="text-white/60">Расклад:</span> {spreadTitle}
        </span>
        <span className="text-white/40">·</span>
        <span>
          <span className="text-white/60">Гадалка:</span> {modelLabel} —{" "}
          {cost} &#8381;{costSuffix}
        </span>
        <span className="text-white/40">·</span>
        <span>
          <span className="text-white/60">Пол:</span> {genderLabel}
        </span>
        <span className="text-white/40">·</span>
        <span>
          <span className="text-white/60">Период:</span> {periodLabel}
        </span>
        {!hideTopic && (
          <>
            <span className="text-white/40">·</span>
            <span>
              <span className="text-white/60">Сферы:</span> {spheresLabel}
            </span>
            <span className="text-white/40">·</span>
            <span>
              <span className="text-white/60">Комментарий:</span>{" "}
              {comment.trim() || "—"}
            </span>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="inline-flex items-center rounded-xl border-2 border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-40"
        >
          <Icon name="Pencil" size={16} className="mr-1.5" />
          Редактировать
        </button>
        <button
          type="button"
          onClick={onClearAll}
          disabled={disabled}
          className="inline-flex items-center rounded-xl border-2 border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-40"
        >
          <Icon name="RotateCcw" size={16} className="mr-1.5" />
          Очистить всё и начать заново
        </button>
      </div>
    </CardContent>
  </Card>
);

export default SpreadSummary;

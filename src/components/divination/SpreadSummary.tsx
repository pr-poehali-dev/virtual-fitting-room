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
  periodLabel?: string;
  spheresLabel: string;
  comment: string;
  /** В диалоге сферы и комментарий не спрашиваются — не показываем их */
  hideTopic?: boolean;
  /** В диалоге менять параметры на ходу нельзя — беседа уже идёт на этой колоде */
  hideEdit?: boolean;
  /** Диалог: меняются заголовок и подписи полей */
  isDialog?: boolean;
  /** Подпись кнопки сброса */
  clearLabel?: string;
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
  hideEdit = false,
  isDialog = false,
  clearLabel = "Очистить всё и начать заново",
  disabled = false,
  onEdit,
  onClearAll,
}: SpreadSummaryProps) => (
  <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-[#2d1b69] via-[#241845] to-[#1a1030] text-white shadow-lg ring-1 ring-[#c9a84c]/25">
    <CardContent className="p-5 sm:p-6">
      {/* Кнопки: на широком экране справа от заголовка,
          на телефоне — над ним, по левому краю */}
      <div className="mb-3 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-serif text-2xl text-[#f3ecff]">
          {isDialog ? "Параметры диалога" : "Параметры расклада"}
        </h2>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!hideEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={disabled}
              className="inline-flex items-center rounded-xl border-2 border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-40"
            >
              <Icon name="Pencil" size={16} className="mr-1.5" />
              Редактировать
            </button>
          )}
          <button
            type="button"
            onClick={onClearAll}
            disabled={disabled}
            className="inline-flex items-center rounded-xl border-2 border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-40"
          >
            <Icon name="RotateCcw" size={16} className="mr-1.5" />
            {clearLabel}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed text-white sm:text-[15px]">
        <span>
          <span className="text-white/60">Способ:</span>{" "}
          {mode === "online"
            ? isDialog
              ? "Онлайн-карты"
              : "Онлайн-расклад"
            : isDialog
              ? "Реальные карты"
              : "Реальный расклад"}
        </span>
        <span className="text-white/40">·</span>
        <span>
          <span className="text-white/60">{isDialog ? "Диалог:" : "Расклад:"}</span>{" "}
          {spreadTitle}
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
        {periodLabel && (
          <>
            <span className="text-white/40">·</span>
            <span>
              <span className="text-white/60">Период:</span> {periodLabel}
            </span>
          </>
        )}
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
    </CardContent>
  </Card>
);

export default SpreadSummary;
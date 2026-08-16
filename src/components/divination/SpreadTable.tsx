import Icon from "@/components/ui/icon";
import type { SpreadDef } from "@/data/divination/spreads";

interface SpreadTableProps {
  spread: SpreadDef;
  /** Названия позиций-домов (для Ленорман) */
  houseNames?: string[];
  /** Выпавшие карты по позициям */
  layout: string[];
  activeIndex: number;
  locked: boolean;
  disabled: boolean;
  onSlotClick: (index: number) => void;
  getCardImage: (name: string) => string | undefined;
}

/**
 * Универсальный стол расклада: рисует карты по геометрии из реестра раскладов.
 * Поддерживает прямоугольную сетку, отдельную нижнюю строку (tail)
 * и расклады с именованными позициями.
 */
const SpreadTable = ({
  spread,
  houseNames,
  layout,
  activeIndex,
  locked,
  disabled,
  onSlotClick,
  getCardImage,
}: SpreadTableProps) => {
  const cols = spread.grid?.cols ?? Math.min(spread.size, 5);
  const rows = spread.grid?.rows ?? 1;
  const tail = spread.grid?.tail ?? 0;
  const mainCount = spread.grid ? cols * rows : spread.size;

  const slotLabel = (idx: number) => {
    if (spread.positions?.[idx]) return `${idx + 1}. ${spread.positions[idx]}`;
    if (houseNames?.[idx]) return `${idx + 1}. дом ${houseNames[idx]}`;
    return `Карта ${idx + 1}`;
  };

  const renderSlot = (idx: number) => {
    const card = layout[idx];
    const isActive = activeIndex === idx && !locked;
    const img = card ? getCardImage(card) : undefined;

    return (
      <button
        key={idx}
        type="button"
        onClick={() => onSlotClick(idx)}
        disabled={disabled}
        className={`flex min-h-[64px] flex-col rounded-lg border p-1.5 text-left transition disabled:cursor-not-allowed ${
          isActive
            ? "border-[#c9a84c] ring-2 ring-[#c9a84c]/60"
            : card
              ? "border-[#c9a84c]/30 bg-white/10"
              : "border-dashed border-white/25 bg-white/[0.04] hover:border-[#c9a84c]/50"
        } ${locked || disabled ? "opacity-60" : ""}`}
      >
        <span className="text-[10px] leading-tight text-[#c9a84c]">
          {slotLabel(idx)}
        </span>
        {img && (
          <img
            src={img}
            alt={card}
            className="mx-auto mt-1 h-24 w-[62px] rounded object-contain sm:h-32 sm:w-[82px]"
            loading="lazy"
          />
        )}
        <span
          className={`mt-auto flex min-h-[28px] items-end text-[11px] font-semibold leading-tight sm:text-xs ${
            card ? "text-[#f3ecff]" : "text-[#9888b8]"
          }`}
        >
          {card || "—"}
        </span>
      </button>
    );
  };

  // Кельтский крест: крест из 6 карт слева и столбец из 4 справа снизу вверх.
  // Раскладываем по клеткам 4 столбца × 4 ряда, карта 2 лежит поперёк первой.
  if (spread.shape === "celtic") {
    const place: Record<number, { col: number; row: number }> = {
      0: { col: 2, row: 2 }, // 1 — центр
      1: { col: 2, row: 2 }, // 2 — поверх центра, поперёк
      2: { col: 2, row: 1 }, // 3 — сверху
      3: { col: 2, row: 3 }, // 4 — снизу
      4: { col: 1, row: 2 }, // 5 — слева
      5: { col: 3, row: 2 }, // 6 — справа
      6: { col: 4, row: 4 }, // 7 — низ столбца
      7: { col: 4, row: 3 },
      8: { col: 4, row: 2 },
      9: { col: 4, row: 1 }, // 10 — верх столбца
    };

    return (
      <div>
        <div
          className="overflow-x-auto rounded-2xl border border-[#c9a84c]/25 p-3 sm:p-4"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 0%, #2d1b69 0%, #241845 55%, #1a1030 100%)",
            boxShadow: "inset 0 0 60px rgba(201,168,76,0.10)",
          }}
        >
          <div
            className="mx-auto grid min-w-[520px] max-w-[720px] gap-2"
            style={{
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gridTemplateRows: "repeat(4, auto)",
            }}
          >
            {Array.from({ length: 10 }, (_, i) => i).map((idx) => {
              const p = place[idx];
              // Карта 2 лежит поперёк первой — кладём её тем же местом
              // и поворачиваем, как на реальном столе
              const crossed = idx === 1;
              return (
                <div
                  key={idx}
                  style={{ gridColumn: p.col, gridRow: p.row }}
                  className={crossed ? "relative z-10 self-center" : ""}
                >
                  <div
                    className={
                      crossed ? "rotate-90 scale-[0.72] drop-shadow-lg" : ""
                    }
                  >
                    {renderSlot(idx)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[#9888b8] lg:hidden">
          <Icon name="ArrowLeft" size={14} />
          <span>Листайте стол вбок, чтобы увидеть все карты</span>
          <Icon name="ArrowRight" size={14} />
        </div>
      </div>
    );
  }

  const mainSlots = Array.from({ length: mainCount }, (_, i) => i);
  const tailSlots = tail
    ? Array.from({ length: tail }, (_, i) => mainCount + i)
    : [];

  const minWidth = cols >= 8 ? "min-w-[760px]" : cols >= 5 ? "min-w-[520px]" : "";

  return (
    <div>
      <div
        className="overflow-x-auto rounded-2xl border border-[#c9a84c]/25 p-3 sm:p-4"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, #2d1b69 0%, #241845 55%, #1a1030 100%)",
          boxShadow: "inset 0 0 60px rgba(201,168,76,0.10)",
        }}
      >
        <div className={minWidth}>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {mainSlots.map(renderSlot)}
          </div>

          {tailSlots.length > 0 && (
            <>
              <div className="my-3 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/30 to-transparent" />
              <div className="flex justify-center">
                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${tailSlots.length}, minmax(0, 1fr))`,
                    width: `${(tailSlots.length / cols) * 100}%`,
                  }}
                >
                  {tailSlots.map(renderSlot)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {cols >= 8 && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[#9888b8] lg:hidden">
          <Icon name="ArrowLeft" size={14} />
          <span>Листайте стол вбок, чтобы увидеть все карты</span>
          <Icon name="ArrowRight" size={14} />
        </div>
      )}
    </div>
  );
};

export default SpreadTable;
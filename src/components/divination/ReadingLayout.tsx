import { getSpread, type DeckId } from "@/data/divination/spreads";
import { getDeck } from "@/data/divination/decks";

interface ReadingLayoutProps {
  /** Колода расклада: lenormand или tarot */
  system: string;
  /** Идентификатор расклада из реестра */
  spreadId: string;
  /** Выпавшие карты по местам */
  layout: string[];
  /** Картинка карты своей колоды */
  getCardImage: (name: string) => string | undefined;
}

// Кельтский крест лежит фигурой, а не сеткой
const CELTIC_PLACE: Record<number, { col: number; row: number }> = {
  0: { col: 2, row: 2 },
  1: { col: 3, row: 2 },
  2: { col: 2, row: 1 },
  3: { col: 2, row: 3 },
  4: { col: 1, row: 2 },
  5: { col: 4, row: 2 },
  6: { col: 5, row: 4 },
  7: { col: 5, row: 3 },
  8: { col: 5, row: 2 },
  9: { col: 5, row: 1 },
};

// «Расклад на план»: 1 в центре, 2 слева, 3 справа, 4 и 5 снизу
const PLAN5_PLACE: Record<number, { col: number; row: number }> = {
  0: { col: 2, row: 1 },
  1: { col: 1, row: 1 },
  2: { col: 3, row: 1 },
  3: { col: 1, row: 2 },
  4: { col: 2, row: 2 },
};

/**
 * Стол готового расклада «только для просмотра»: карты лежат так же,
 * как их выложили. Используется в личном кабинете, чтобы человек видел
 * не только текст, но и сам расклад.
 */
const ReadingLayout = ({
  system,
  spreadId,
  layout,
  getCardImage,
}: ReadingLayoutProps) => {
  if (!layout || layout.length === 0) return null;

  const spread = getSpread(spreadId);
  const shape = spread?.shape;
  const isCeltic = shape === "celtic";
  const isPlan5 = shape === "plan5";

  const placeNames =
    spread?.positions ?? getDeck(system as DeckId)?.houseNames ?? [];
  const placeWord = system === "tarot" ? "позиция" : "дом";

  const cols = isCeltic ? 5 : isPlan5 ? 3 : spread?.grid?.cols || Math.min(layout.length, 6);

  const cellStyle = (idx: number) => {
    if (isCeltic) {
      const p = CELTIC_PLACE[idx];
      return p ? { gridColumn: p.col, gridRow: p.row } : undefined;
    }
    if (isPlan5) {
      const p = PLAN5_PLACE[idx];
      return p ? { gridColumn: p.col, gridRow: p.row } : undefined;
    }
    // Отдельная итоговая строка внизу (расклад 8×4 + 4)
    const g = spread?.grid;
    if (!g?.tail || !g.cols || !g.rows) return undefined;
    const start = g.cols * g.rows;
    if (idx !== start) return undefined;
    const offset = Math.max(1, Math.floor((g.cols - g.tail) / 2) + 1);
    return { gridColumnStart: offset };
  };

  // В кельтском кресте вторая карта лежит поперёк первой
  const isCrossed = (idx: number) => isCeltic && idx === 1;

  // Широкие расклады листаются вбок, узкие помещаются целиком
  const minWidth = cols >= 8 ? "min-w-[760px]" : cols >= 5 ? "min-w-[560px]" : "";

  return (
    <div>
      <div
        className="overflow-x-auto rounded-2xl p-3 sm:p-4"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 0%, #2d1b69 0%, #241845 55%, #1a1030 100%)",
          boxShadow: "inset 0 0 50px rgba(124,58,237,0.18)",
        }}
      >
        <div
          className={`grid gap-1.5 [grid-auto-rows:1fr] ${minWidth}`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {layout.map((card, idx) =>
            card ? (
              <div
                key={idx}
                style={cellStyle(idx)}
                className="rounded-md border border-[#c9a84c]/25 bg-white/[0.06] p-1.5 text-center"
              >
                <div className="text-[10px] leading-tight text-[#c9a84c]">
                  {idx + 1}
                  {placeNames[idx] ? `. ${placeWord} ${placeNames[idx]}` : ""}
                </div>
                {getCardImage(card) && (
                  <img
                    src={getCardImage(card)}
                    alt={card}
                    className={`mx-auto my-1 h-[86px] w-[56px] rounded object-contain sm:h-[112px] sm:w-[72px] ${
                      isCrossed(idx) ? "rotate-90" : ""
                    }`}
                    loading="lazy"
                  />
                )}
                <div className="text-[11px] font-semibold leading-tight text-[#f3ecff]">
                  {card}
                </div>
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
};

export default ReadingLayout;

import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { divTheme } from "./theme";
import { QUESTION_HINT } from "./texts";
import HintPopover from "./HintPopover";

// Предел длины вопроса: хватает на несколько подвопросов,
// но не даёт вставить в поле большой текст
export const QUESTION_MAX = 450;

interface DialogAskFormProps {
  stepsCount: number;
  stepPrice: number;
  question: string;
  setQuestion: (v: string) => void;
  busy: boolean;
  lowBalance: boolean;
  stepDeckMode: "full" | "single";
  changeStepDeckMode: (mode: "full" | "single") => void;
  availableCards: () => string[];
  tableRef: React.RefObject<HTMLDivElement>;
  picked: string[];
  maxCards: number;
  mode: "online" | "real";
  hasQuestion: boolean;
  shuffled: boolean;
  shuffleDeck: () => void;
  resetDraw: () => void;
  getCardImage: (name: string) => string | undefined;
  ready: boolean;
  send: () => void;
  onNeedTopup: () => void;
  onAskClose: () => void;
  stepsLeft: number;
  deck: string[];
  drawCardAt: (index: number) => void;
  pickNamedCard: (card: string) => void;
  backImage: string;
}

/** Форма нового вопроса: текст, выбор колоды, стол расклада и сама колода. */
const DialogAskForm = ({
  stepsCount,
  stepPrice,
  question,
  setQuestion,
  busy,
  lowBalance,
  stepDeckMode,
  changeStepDeckMode,
  availableCards,
  tableRef,
  picked,
  maxCards,
  mode,
  hasQuestion,
  shuffled,
  shuffleDeck,
  resetDraw,
  getCardImage,
  ready,
  send,
  onNeedTopup,
  onAskClose,
  stepsLeft,
  deck,
  drawCardAt,
  pickNamedCard,
  backImage,
}: DialogAskFormProps) => (
  <div className={`${divTheme.panel} p-4 sm:p-5`}>
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3
        className={`flex items-center gap-2 font-serif text-xl ${divTheme.title} sm:text-2xl`}
      >
        {stepsCount === 0
          ? "Задайте вопрос картам"
          : `Уточняющий вопрос ${stepsCount + 1}`}
        <HintPopover title="О чём спрашивать карты" text={QUESTION_HINT} />
      </h3>
      <span className="text-right text-sm font-semibold text-[#c9a84c]">
        {stepPrice} &#8381; за вопрос
      </span>
    </div>

    <Textarea
      value={question}
      onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_MAX))}
      maxLength={QUESTION_MAX}
      placeholder="Например: как сложится новый проект?"
      disabled={busy || lowBalance}
      className="mb-1 min-h-[80px] border-2 border-white/50 bg-transparent text-white placeholder:text-white/60 focus-visible:ring-white/40"
    />

    {/* Счётчик появляется, когда до предела остаётся немного */}
    <p className="mb-3 text-right text-xs text-white/50">
      {question.length} / {QUESTION_MAX}
    </p>

    {/* Колода для ЭТОГО вопроса: выбирается заново каждый раз.
        У первого вопроса выбора нет — колода ещё полная. */}
    {stepsCount > 0 && (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`text-sm ${divTheme.muted}`}>Колода:</span>
        {(
          [
            {
              key: "single",
              label: "Та же колода",
              hint: "Выпавшие карты не возвращаются",
            },
            {
              key: "full",
              label: "Полная колода",
              hint: "Колода собирается заново",
            },
          ] as const
        ).map((o) => (
          <button
            key={o.key}
            type="button"
            title={o.hint}
            onClick={() => changeStepDeckMode(o.key)}
            disabled={busy}
            className={`rounded-lg px-3 py-1.5 text-xs ring-1 transition ${
              stepDeckMode === o.key
                ? "bg-[#c9a84c]/18 text-[#f3ecff] ring-[#c9a84c]/60"
                : "bg-white/[0.03] text-[#9888b8] ring-white/10 hover:text-[#e8e0f0]"
            }`}
          >
            {o.label}
          </button>
        ))}
        <span className="text-xs text-[#9888b8]">
          {stepDeckMode === "single"
            ? `осталось ${availableCards().length} карт`
            : "все карты доступны"}
        </span>
      </div>
    )}

    <div ref={tableRef} className="mb-3 scroll-mt-20">
      {/* Шапка стола: главное действие на виду, как в раскладах.
          На мобильном перестраивается в столбик. */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h4 className="font-serif text-lg text-[#f3ecff]">Стол расклада</h4>
          <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs text-[#c9bfe0]">
            {picked.length}/{maxCards}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {mode === "online" && (
            <Button
              type="button"
              size="lg"
              onClick={shuffleDeck}
              disabled={busy || !hasQuestion}
              className={`${divTheme.btnHero} w-full sm:w-auto disabled:opacity-40`}
            >
              <Icon name="Shuffle" size={20} className="mr-2" />
              Перемешать карты
            </Button>
          )}
          {picked.length > 0 && (
            <Button
              variant="ghost"
              onClick={resetDraw}
              disabled={busy}
              className="flex-1 border border-white/25 text-[#e8e0f0] hover:bg-white/8 hover:text-white sm:flex-none"
            >
              <Icon name="Eraser" size={16} className="mr-1.5" />
              Перетянуть
            </Button>
          )}
        </div>
      </div>

      {/* Подсказка одной строкой под шапкой */}
      <p className="mb-2 text-sm text-[#9888b8]">
        {mode === "online" && !hasQuestion
          ? "Сначала напишите вопрос — потом перемешайте колоду"
          : mode === "online" && !shuffled
            ? "Сосредоточьтесь на вопросе и перемешайте колоду"
            : `Колода находится ниже. Вы можете вытянуть на этот вопрос от 1 до ${maxCards} карт. Выбрано: ${picked.length}`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {picked.map((c, i) => {
          const img = getCardImage(c);
          return (
            <div
              key={`${c}-${i}`}
              className="rounded-lg bg-[#c9a84c]/12 p-1.5 text-center ring-1 ring-[#c9a84c]/40"
            >
              {img && (
                <img
                  src={img}
                  alt={c}
                  className="mx-auto h-[86px] w-[56px] rounded object-contain sm:h-[112px] sm:w-[72px]"
                  loading="lazy"
                />
              )}
              <span className="mt-1 block text-[11px] text-[#c9a84c]">{c}</span>
            </div>
          );
        })}

        {picked.length < maxCards && (
          <div className="flex h-[122px] w-[68px] flex-col items-center justify-center rounded-lg border border-dashed border-[#c9a84c]/30 px-1 text-center text-[10px] leading-tight text-[#9888b8] sm:h-[148px] sm:w-[84px]">
            {picked.length === 0 ? "Вытяните карту" : "Можно ещё"}
          </div>
        )}
      </div>
    </div>

    {/* Денег не хватает: переписка остаётся видна, закрыт только новый вопрос */}
    {lowBalance ? (
      <div className="mb-3 rounded-xl border border-[#c9a84c]/40 bg-[#c9a84c]/10 p-3">
        <p className="mb-2 text-sm text-[#f3ecff]">
          Не хватает средств на следующий вопрос — нужно {stepPrice} &#8381;.
          Ответы гадалки выше остаются с вами.
        </p>
        <Button size="sm" onClick={onNeedTopup} className={divTheme.btnHero}>
          <Icon name="Wallet" size={16} className="mr-1.5" />
          Пополнить счёт
        </Button>
      </div>
    ) : (
      !busy &&
      !ready && (
        <p className="mb-2 text-sm text-[#c9a84c]">
          {!hasQuestion
            ? "Напишите вопрос — без него карты не трактуем"
            : "Выберите хотя бы одну карту"}
        </p>
      )
    )}

    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button
        size="lg"
        onClick={send}
        disabled={!ready || busy}
        title={
          !ready
            ? !hasQuestion
              ? "Сначала напишите вопрос"
              : "Выберите хотя бы одну карту"
            : undefined
        }
        className={`${divTheme.btnHero} w-full disabled:opacity-50 sm:w-auto`}
      >
        {busy ? (
          <>
            <Icon name="Loader2" size={16} className="mr-1.5 animate-spin" />
            Карты отвечают, подождите...
          </>
        ) : (
          <>
            <Icon name="Sparkles" size={20} className="mr-2" />
            Трактовать с помощью ИИ ({stepPrice} &#8381;)
          </>
        )}
      </Button>

      {stepsCount > 0 && (
        <Button
          variant="ghost"
          onClick={onAskClose}
          disabled={busy}
          className={divTheme.btnGhost}
        >
          Закрыть диалог
        </Button>
      )}

      <span className={`ml-auto text-xs ${divTheme.muted}`}>
        Осталось вопросов: {stepsLeft}
      </span>
    </div>
    {/* РЕАЛЬНЫЙ расклад: карты лицом — вы уже разложили их у себя
        и просто отмечаете, что выпало. */}
    {picked.length < maxCards && mode === "real" && (
      <div className="mb-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
        <p className={`mb-2 text-sm ${divTheme.muted}`}>
          Отметьте карты, которые выпали у вас в реальном раскладе
        </p>
        <div className="flex max-h-[220px] flex-wrap gap-1.5 overflow-y-auto">
          {availableCards().map((card) => {
            const img = getCardImage(card);
            return (
              <button
                key={card}
                type="button"
                onClick={() => pickNamedCard(card)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full border border-[#c9a84c]/40 bg-[#c9a84c]/10 py-1 pl-1 pr-2.5 text-sm text-[#e8e0f0] transition hover:bg-[#c9a84c]/20 disabled:opacity-50"
              >
                {img && (
                  <img
                    src={img}
                    alt={card}
                    className="h-8 w-8 rounded-full object-cover"
                    loading="lazy"
                  />
                )}
                {card}
              </button>
            );
          })}
        </div>
      </div>
    )}

    {/* ОНЛАЙН: колода рубашками вверх, карту тянут вслепую */}
    {picked.length < maxCards && mode === "online" && shuffled && (
      <div className="mb-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
        <p className={`mb-2 text-center text-sm ${divTheme.muted}`}>
          Выберите карту из колоды — она откроется только после выбора
        </p>
        <div className="flex flex-wrap justify-center gap-1">
          {deck.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => drawCardAt(i)}
              disabled={busy}
              aria-label="Вытянуть карту"
              className="h-[86px] w-[56px] overflow-hidden rounded border border-[#c9a84c]/30 transition hover:-translate-y-1 hover:border-[#c9a84c] disabled:opacity-50 sm:h-[112px] sm:w-[72px]"
            >
              <img
                src={backImage}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default DialogAskForm;

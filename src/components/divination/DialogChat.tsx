import { useEffect, useState } from "react";
import { toast } from "sonner";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { divTheme } from "./theme";
import { downloadDialogText } from "./SavedDialogs";
import type { SpreadDef } from "@/data/divination/spreads";

const DIVINATION_DIALOG =
  "https://functions.poehali.dev/336075f7-e6e8-4cd9-bfd5-80e6e23e187a";

export interface DialogStep {
  step_no: number;
  question: string;
  cards: string[];
  answer: string;
}

interface DialogChatProps {
  spread: SpreadDef;
  /** Рубашка колоды — по ней кликают, чтобы вытянуть карту */
  backImage: string;
  /** Сколько карт тянуть на один вопрос (1..6) */
  cardsPerStep: number;
  /** full — каждый вопрос новая колода, single — одна на весь диалог */
  deckMode: "full" | "single";
  /** Беседа, к которой вернулись из списка сохранённых */
  resumeDialog?: { dialog_id: string } | null;
  /** Сообщить наружу, что список бесед изменился */
  onDialogChanged?: () => void;
  /** Параметры из мастера — уходят в первый вопрос как контекст */
  context?: {
    gender: string;
    period: string;
    spheres: string[];
    comment: string;
  };
  deckCards: string[];
  model: string;
  stepPrice: number;
  maxSteps: number;
  getCardImage: (name: string) => string | undefined;
  onBalanceChange: () => void;
  onNeedTopup: () => void;
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Диалог-гадание: вопрос → карты → ответ → уточняющий вопрос.
 * Карты тянутся из ПОЛНОЙ колоды на каждом шаге.
 */
const DialogChat = ({
  spread,
  backImage,
  cardsPerStep,
  deckMode,
  resumeDialog,
  onDialogChanged,
  context,
  deckCards,
  model,
  stepPrice,
  maxSteps,
  getCardImage,
  onBalanceChange,
  onNeedTopup,
}: DialogChatProps) => {
  const [dialogId, setDialogId] = useState<string | null>(null);
  const [steps, setSteps] = useState<DialogStep[]>([]);
  const [question, setQuestion] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [deck, setDeck] = useState<string[]>(() => shuffle(deckCards));
  // Карты, уже выпавшие в этом диалоге (для режима «одна колода»)
  const [usedCards, setUsedCards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const api = async (payload: Record<string, unknown>) => {
    const token = localStorage.getItem("session_token");
    const res = await fetch(DIVINATION_DIALOG, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Session-Token": token } : {}),
      },
      body: JSON.stringify(payload),
    });
    return { res, data: await res.json() };
  };

  // Возвращаемся к сохранённой беседе (по кнопке) либо к последней незакрытой
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = resumeDialog?.dialog_id
          ? { action: "history", dialog_id: resumeDialog.dialog_id }
          : { action: "last" };
        const { res, data } = await api(payload);
        if (cancelled || !res.ok || data.empty) return;
        if (!resumeDialog && data.spread !== spread.id) return;

        setDialogId(data.dialog_id);
        setSteps(data.steps || []);
        // В режиме «одна колода» помним, что уже выпало
        const used = (data.steps || []).flatMap(
          (st: { cards?: string[] }) => st.cards || [],
        );
        setUsedCards(used);
        setClosed(data.status === "closed");
      } catch {
        /* тихо: продолжаем с чистого диалога */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread.id, resumeDialog?.dialog_id]);

  const need = Math.max(1, Math.min(cardsPerStep || 1, spread.size));
  const ready = question.trim().length > 0 && picked.length === need;
  const stepsLeft = maxSteps - steps.length;

  // В режиме «одна колода» выпавшие карты больше не участвуют
  const availableCards = () =>
    deckMode === "single"
      ? deckCards.filter((c) => !usedCards.includes(c))
      : deckCards;

  const shuffleDeck = () => {
    if (busy) return;
    const pool = availableCards();
    if (pool.length < need) {
      toast.info("Колода закончилась — начните новый диалог");
      return;
    }
    setDeck(shuffle(pool));
    setShuffled(true);
    toast.success("Карты перемешаны — тяните карту из колоды");
  };

  // Карта вытягивается вслепую: человек кликает по рубашке в колоде
  const drawCardAt = (index: number) => {
    if (busy || picked.length >= need) return;
    if (!shuffled) {
      toast.info("Сначала перемешайте карты");
      return;
    }
    setDeck((d) => {
      if (!d.length) return d;
      const i = Math.min(index, d.length - 1);
      setPicked((p) => [...p, d[i]]);
      return d.filter((_, k) => k !== i);
    });
  };

  const resetDraw = () => {
    setPicked([]);
    setDeck(shuffle(availableCards()));
    setShuffled(false);
  };

  const send = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      let id = dialogId;
      if (!id) {
        const { res, data } = await api({
          action: "start",
          system: spread.deck,
          spread: spread.id,
          model,
          cards_per_step: need,
          deck_mode: deckMode,
          gender: context?.gender,
          period: context?.period,
          spheres: context?.spheres,
          comment: context?.comment,
        });
        if (!res.ok) {
          toast.error(data.error || "Не удалось начать диалог");
          return;
        }
        id = data.dialog_id;
        setDialogId(id);
      }

      const { res, data } = await api({
        action: "ask",
        dialog_id: id,
        question: question.trim(),
        cards: picked,
      });

      if (res.status === 402) {
        toast.error(`Недостаточно средств. Нужно ${stepPrice} \u20bd`);
        onNeedTopup();
        return;
      }
      if (!res.ok || data.status === "failed") {
        toast.error(data.error || "Не удалось получить ответ");
        return;
      }

      // Нейросеть отвечает не мгновенно — ждём готовности шага
      onBalanceChange();
      const stepId = data.step_id;
      const started = Date.now();
      let ready = null;

      while (Date.now() - started < 180000) {
        await new Promise((r) => setTimeout(r, 3000));
        const poll = await api({ action: "step_status", step_id: stepId });
        if (!poll.res.ok) continue;
        if (poll.data.status === "done") {
          ready = poll.data;
          break;
        }
        if (poll.data.status === "failed") {
          toast.error(poll.data.error || "Не удалось получить ответ");
          onBalanceChange();
          return;
        }
      }

      if (!ready) {
        toast.error(
          "Ответ готовится дольше обычного. Обновите страницу через минуту.",
        );
        return;
      }

      setSteps((prev) => [
        ...prev,
        {
          step_no: ready.step_no,
          question: ready.question,
          cards: ready.cards || [],
          answer: ready.answer || "",
        },
      ]);
      setQuestion("");
      if (deckMode === "single") {
        setUsedCards((prev) => [...prev, ...(ready.cards || [])]);
      }
      setPicked([]);
      setShuffled(false);
      onDialogChanged?.();
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = async () => {
    if (!dialogId) {
      setClosed(true);
      return;
    }
    const { data } = await api({ action: "close", dialog_id: dialogId });
    setClosed(true);
    setConfirmClose(false);
    onDialogChanged?.();
    toast.success(
      data?.deleted_old
        ? "Диалог закрыт. Прежняя закрытая беседа удалена."
        : "Диалог закрыт",
    );
  };

  const downloadThis = async () => {
    if (dialogId) await downloadDialogText(dialogId);
  };

  return (
    <div className="space-y-4">
      {steps.map((s) => (
        <div key={s.step_no} className={`${divTheme.panel} p-4 sm:p-5`}>
          <div className="mb-3 flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c9a84c]/20 text-xs font-semibold text-[#c9a84c]">
              {s.step_no}
            </span>
            <p className="flex-1 font-medium text-[#f3ecff]">{s.question}</p>
          </div>

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
                      className="mx-auto h-20 w-[52px] rounded object-contain"
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

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#e8e0f0]">
            {s.answer}
          </p>
        </div>
      ))}

      {confirmClose && (
        <div className={`${divTheme.panel} p-5`}>
          <div className="mb-3 flex items-start gap-2">
            <Icon
              name="TriangleAlert"
              size={20}
              className="mt-0.5 shrink-0 text-[#c9a84c]"
            />
            <div className="text-sm text-[#e8d9a8]">
              <p className="mb-1 font-medium text-[#f3ecff]">
                Закрыть эту беседу?
              </p>
              <p>
                Незакрытые диалоги хранятся всегда, а из закрытых остаётся
                только последний. Прежняя закрытая беседа будет удалена —
                скачайте её, если она нужна.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={downloadThis}
              className={divTheme.btnPrimary}
              size="sm"
            >
              <Icon name="Download" size={15} className="mr-1.5" />
              Скачать эту беседу
            </Button>
            <Button onClick={closeDialog} size="sm" className={divTheme.btnGhost}>
              Всё равно закрыть
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmClose(false)}
              size="sm"
              className={divTheme.btnGhost}
            >
              Отмена
            </Button>
          </div>
        </div>
      )}

      {closed ? (
        <div className={`${divTheme.panel} p-5 text-center`}>
          <Icon
            name="CheckCircle2"
            size={28}
            className="mx-auto mb-2 text-[#c9a84c]"
          />
          <p className="text-[#f3ecff]">Диалог закрыт</p>
          <p className={`mt-1 text-sm ${divTheme.muted}`}>
            Задано вопросов: {steps.length}
          </p>
        </div>
      ) : stepsLeft <= 0 ? (
        <div className={`${divTheme.panel} p-5 text-center`}>
          <p className="text-[#f3ecff]">
            Достигнут предел в {maxSteps} вопросов
          </p>
          <p className={`mt-1 text-sm ${divTheme.muted}`}>
            Начните новый диалог, чтобы продолжить
          </p>
        </div>
      ) : (
        <div className={`${divTheme.panel} p-4 sm:p-5`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className={`text-sm ${divTheme.muted}`}>
              {steps.length === 0
                ? "Задайте вопрос картам"
                : `Уточняющий вопрос ${steps.length + 1}`}
            </span>
            <span className="text-sm font-semibold text-[#c9a84c]">
              {stepPrice} &#8381; за вопрос
            </span>
          </div>

          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Например: как сложится этот проект?"
            disabled={busy}
            className="mb-3 min-h-[80px] border-white/15 bg-white/[0.04] text-[#e8e0f0] placeholder:text-[#9888b8]"
          />

          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className={`text-sm ${divTheme.muted}`}>
                Карты: {picked.length} из {need}
              </span>
              {picked.length > 0 && (
                <button
                  type="button"
                  onClick={resetDraw}
                  disabled={busy}
                  className="text-xs text-[#9888b8] underline hover:text-[#c9a84c]"
                >
                  Перетянуть
                </button>
              )}
            </div>

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
                        className="mx-auto h-20 w-[52px] rounded object-contain"
                        loading="lazy"
                      />
                    )}
                    <span className="mt-1 block text-[11px] text-[#c9a84c]">
                      {c}
                    </span>
                  </div>
                );
              })}

              {picked.length < need && (
                <div className="flex h-[104px] w-[68px] flex-col items-center justify-center rounded-lg border border-dashed border-[#c9a84c]/30 text-center text-[10px] text-[#9888b8]">
                  Карта {picked.length + 1}
                </div>
              )}
            </div>
          </div>

          {/* Колода рубашками вверх: карту тянут вслепую, кликая по рубашке */}
          {picked.length < need && (
            <div className="mb-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              {!shuffled ? (
                <div className="text-center">
                  <p className={`mb-2 text-sm ${divTheme.muted}`}>
                    Сосредоточьтесь на вопросе и перемешайте колоду
                  </p>
                  <Button
                    type="button"
                    onClick={shuffleDeck}
                    disabled={busy}
                    className={divTheme.btnGhost}
                  >
                    <Icon name="Shuffle" size={16} className="mr-1.5" />
                    Перемешать карты
                  </Button>
                </div>
              ) : (
                <>
                  <p className={`mb-2 text-center text-sm ${divTheme.muted}`}>
                    Выберите карту из колоды — она откроется только после выбора
                  </p>
                  <div className="flex max-h-[150px] flex-wrap justify-center gap-1 overflow-y-auto">
                    {deck.slice(0, 40).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => drawCardAt(i)}
                        disabled={busy}
                        aria-label="Вытянуть карту"
                        className="h-[62px] w-[42px] overflow-hidden rounded border border-[#c9a84c]/30 transition hover:-translate-y-1 hover:border-[#c9a84c] disabled:opacity-50"
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
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={send}
              disabled={!ready || busy}
              className={`${divTheme.btnPrimary} disabled:opacity-50`}
            >
              {busy ? (
                <>
                  <Icon
                    name="Loader2"
                    size={16}
                    className="mr-1.5 animate-spin"
                  />
                  Карты отвечают, подождите...
                </>
              ) : (
                <>
                  <Icon name="Send" size={16} className="mr-1.5" />
                  Спросить за {stepPrice} &#8381;
                </>
              )}
            </Button>

            {steps.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setConfirmClose(true)}
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
        </div>
      )}
    </div>
  );
};

export default DialogChat;

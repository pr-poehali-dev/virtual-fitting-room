import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { divTheme } from "./theme";
import { QUESTION_HINT } from "./texts";
import HintPopover from "./HintPopover";
import {
  downloadDialogText,
  isMobileDevice,
  shareDialogText,
} from "./SavedDialogs";
import type { SpreadDef } from "@/data/divination/spreads";
import { playReadySound } from "@/components/selection/selectionUtils";
import ReadAloud from "./ReadAloud";
import ReadingText from "./ReadingText";

const DIVINATION_DIALOG =
  "https://functions.poehali.dev/336075f7-e6e8-4cd9-bfd5-80e6e23e187a";

// Предел длины вопроса: хватает на несколько подвопросов,
// но не даёт вставить в поле большой текст
const QUESTION_MAX = 700;

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
  /** online — тянем вслепую из рубашек, real — выбираем карту лицом */
  mode: "online" | "real";
  /** full — каждый вопрос новая колода, single — одна на весь диалог */
  deckMode: "full" | "single";
  /** Беседа, к которой вернулись из списка сохранённых */
  resumeDialog?: { dialog_id: string } | null;
  /** Сообщить наружу, что список бесед изменился */
  onDialogChanged?: () => void;
  /** Сообщить наружу, сколько ответов уже есть в беседе */
  onStepsChange?: (count: number) => void;
  /** Параметры из мастера — уходят в первый вопрос как контекст */
  context?: {
    gender: string;
    period?: string;
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
  /** Денег не хватает на следующий вопрос: переписку показываем, отправку — нет */
  lowBalance?: boolean;
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
  mode,
  deckMode,
  resumeDialog,
  onDialogChanged,
  onStepsChange,
  context,
  deckCards,
  model,
  stepPrice,
  maxSteps,
  getCardImage,
  onBalanceChange,
  onNeedTopup,
  lowBalance = false,
}: DialogChatProps) => {
  const [dialogId, setDialogId] = useState<string | null>(null);
  const [steps, setSteps] = useState<DialogStep[]>([]);

  // Наверху по числу ответов меняется подпись кнопки «Начать заново»
  useEffect(() => {
    onStepsChange?.(steps.length);
  }, [steps.length, onStepsChange]);
  const [question, setQuestion] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [deck, setDeck] = useState<string[]>(() => shuffle(deckCards));
  // Карты, уже выпавшие в этом диалоге (для режима «одна колода»)
  const [usedCards, setUsedCards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  // Шаги-карточки: к началу свежего ответа подкручиваем страницу
  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});
  // Сколько ответов было в прошлый раз — чтобы отличить новый от загрузки истории
  const prevCountRef = useRef(0);

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

  // Историю подтягиваем ТОЛЬКО по явной кнопке «Вернуться к диалогу».
  // Иначе новый диалог молча подхватывал прошлую беседу.
  useEffect(() => {
    let cancelled = false;
    if (!resumeDialog?.dialog_id) {
      // Новый диалог — всегда с чистого листа
      setDialogId(null);
      setSteps([]);
      setUsedCards([]);
      setClosed(false);
      return;
    }
    (async () => {
      try {
        const { res, data } = await api({
          action: "history",
          dialog_id: resumeDialog.dialog_id,
        });
        if (cancelled || !res.ok || data.empty) return;

        setDialogId(data.dialog_id);
        setSteps(data.steps || []);
        // В режиме «одна колода» помним, что уже выпало
        const used = (data.steps || []).flatMap(
          (st: { cards?: string[] }) => st.cards || [],
        );
        setUsedCards(used);
        // Продолжаем диалог с тем режимом колоды, что был у него
        if (data.deck_mode === "single" || data.deck_mode === "full") {
          setStepDeckMode(data.deck_mode);
        }
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

  // Сколько карт можно вытянуть на один вопрос (верхняя граница)
  const maxCards = Math.max(1, Math.min(cardsPerStep || 6, spread.size));
  // Отправить можно с любым количеством от 1 до maxCards
  // Тянуть карты можно, как только вопрос начали печатать
  const hasQuestion = question.trim().length > 0;
  const ready = hasQuestion && picked.length >= 1 && !lowBalance;
  const stepsLeft = maxSteps - steps.length;

  // Режим колоды человек выбирает для КАЖДОГО вопроса заново
  const [stepDeckMode, setStepDeckMode] = useState<"full" | "single">(deckMode);
  // «Та же колода» — выпавшие карты больше не участвуют.
  // «Полная колода» — колода собирается заново, отбор начинается с нуля.
  // Карты, уже вытянутые на ЭТОТ вопрос, второй раз не предлагаем
  const availableCards = (
    mode = stepDeckMode,
    drawn = picked,
    used = usedCards,
  ) =>
    (mode === "single"
      ? deckCards.filter((c) => !used.includes(c))
      : deckCards
    ).filter((c) => !drawn.includes(c));

  // Смена режима до вытягивания карт: пересобираем колоду под новый режим
  const changeStepDeckMode = (mode: "full" | "single") => {
    if (busy || mode === stepDeckMode) return;
    setStepDeckMode(mode);
    // Историю выпавших карт не стираем: в режиме «Полная колода» она просто
    // не учитывается, но нужна, чтобы можно было вернуться к «Той же колоде».
    setPicked([]);
    setShuffled(false);
    setDeck(shuffle(availableCards(mode, [], usedCards)));
  };

  const shuffleDeck = () => {
    if (busy) return;
    const pool = availableCards();
    if (pool.length < 1) {
      toast.info("Колода закончилась — начните новый диалог");
      return;
    }
    setDeck(shuffle(pool));
    setShuffled(true);
    toast.success("Карты перемешаны — тяните карту из колоды");
  };

  // Реальный расклад: человек сам указывает выпавшую карту
  const pickNamedCard = (card: string) => {
    if (busy || picked.length >= maxCards) return;
    if (picked.includes(card)) return;
    setPicked((p) => [...p, card]);
  };

  // Карта вытягивается вслепую: человек кликает по рубашке в колоде
  const drawCardAt = (index: number) => {
    if (busy || picked.length >= maxCards) return;
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
    setDeck(shuffle(availableCards(stepDeckMode, [])));
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
          cards_per_step: maxCards,
          deck_mode: stepDeckMode,
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

      // Ответа ждут — зовём звуком, если вкладка свёрнута
      playReadySound();
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
      // Копим все выпавшие карты диалога независимо от режима:
      // «Полная колода» их просто не учитывает при отборе.
      setUsedCards((prev) => [
        ...new Set([...prev, ...((ready.cards || []) as string[])]),
      ]);
      setPicked([]);
      setShuffled(false);
      onDialogChanged?.();
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Пришёл новый ответ — плавно подкручиваем к его началу.
   * Ответы длинные: без этого человек остаётся у формы вопроса
   * и не видит, что ответ уже пришёл выше.
   */
  useEffect(() => {
    const isNew =
      steps.length > prevCountRef.current && prevCountRef.current > 0;
    const first =
      prevCountRef.current === 0 && steps.length > 0 && !resumeDialog;
    prevCountRef.current = steps.length;
    if (!isNew && !first) return;

    const last = steps[steps.length - 1];
    const el = last && stepRefs.current[last.step_no];
    if (!el) return;
    // Ждём отрисовку текста, иначе прокрутим не туда
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

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
        <div
          key={s.step_no}
          ref={(el) => {
            stepRefs.current[s.step_no] = el;
          }}
          className={`${divTheme.panel} scroll-mt-20 p-4 sm:p-5`}
        >
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
        </div>
      ))}

      {/* Спрашиваем поверх страницы: кнопка «Закрыть диалог» внизу, и врезка
          в потоке уезжала за экран — человек не видел, что у него спросили */}
      {confirmClose &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
            <div
              className={`${divTheme.panel} max-h-[90vh] w-full max-w-md overflow-y-auto p-5`}
            >
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
                    Незакрытая беседа остаётся здесь: к ней можно вернуться и
                    продолжить разговор — гадалка помнит всё, о чём вы говорили.
                    Закрытые беседы тут не показываются, но сохраняются в личном
                    кабинете, в разделе{" "}
                    <a
                      href="/profile/history-divination"
                      className="font-medium text-[#c9a84c] underline underline-offset-2"
                    >
                      «Мои гадания»
                    </a>{" "}
                    — там их можно перечитать.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={closeDialog}
                  size="sm"
                  className={divTheme.btnPrimary}
                >
                  Закрыть беседу
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
          </div>,
          document.body,
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
          {/* Беседа осталась в кабинете — подсказываем, где её перечитать */}
          <p className="mx-auto mt-3 max-w-md text-sm text-[#e8d9a8]">
            Беседа сохранена в личном кабинете, в разделе{" "}
            <a
              href="/profile/history-divination"
              className="font-medium text-[#c9a84c] underline underline-offset-2"
            >
              «Мои гадания»
            </a>
            .
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button
              size="sm"
              onClick={() => dialogId && shareDialogText(dialogId)}
              className={divTheme.btnPrimary}
            >
              <Icon
                name={isMobileDevice() ? "Share2" : "Copy"}
                size={15}
                className="mr-1.5"
              />
              {isMobileDevice() ? "Поделиться беседой" : "Скопировать беседу"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={downloadThis}
              className={divTheme.btnGhost}
            >
              <Icon name="Download" size={15} className="mr-1.5" />
              Скачать
            </Button>
          </div>
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
            <h3
              className={`flex items-center gap-2 font-serif text-xl ${divTheme.title} sm:text-2xl`}
            >
              {steps.length === 0
                ? "Задайте вопрос картам"
                : `Уточняющий вопрос ${steps.length + 1}`}
              <HintPopover
                title="О чём спрашивать карты"
                text={QUESTION_HINT}
              />
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
          {steps.length > 0 && (
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

          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className={`text-sm ${divTheme.muted}`}>
                Вы можете вытянуть на этот вопрос от 1 до {maxCards} карт.
                Выбрано: {picked.length}
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

              {picked.length < maxCards && (
                <div className="flex h-[122px] w-[68px] flex-col items-center justify-center rounded-lg border border-dashed border-[#c9a84c]/30 px-1 text-center text-[10px] leading-tight text-[#9888b8] sm:h-[148px] sm:w-[84px]">
                  {picked.length === 0 ? "Вытяните карту" : "Можно ещё"}
                </div>
              )}
            </div>
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
          {picked.length < maxCards && mode === "online" && (
            <div className="mb-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              {!shuffled ? (
                <div className="text-center">
                  <p className={`mb-2 text-sm ${divTheme.muted}`}>
                    {hasQuestion
                      ? "Сосредоточьтесь на вопросе и перемешайте колоду"
                      : "Сначала напишите вопрос — потом перемешайте колоду"}
                  </p>
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
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}

          {/* Денег не хватает: переписка остаётся видна, закрыт только новый вопрос */}
          {lowBalance ? (
            <div className="mb-3 rounded-xl border border-[#c9a84c]/40 bg-[#c9a84c]/10 p-3">
              <p className="mb-2 text-sm text-[#f3ecff]">
                Не хватает средств на следующий вопрос — нужно {stepPrice}{" "}
                &#8381;. Ответы гадалки выше остаются с вами.
              </p>
              <Button
                size="sm"
                onClick={onNeedTopup}
                className={divTheme.btnHero}
              >
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

          <div className="flex flex-wrap items-center gap-2">
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
                  <Icon
                    name="Loader2"
                    size={16}
                    className="mr-1.5 animate-spin"
                  />
                  Карты отвечают, подождите...
                </>
              ) : (
                <>
                  <Icon name="Sparkles" size={20} className="mr-2" />
                  Трактовать с помощью ИИ ({stepPrice} &#8381;)
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

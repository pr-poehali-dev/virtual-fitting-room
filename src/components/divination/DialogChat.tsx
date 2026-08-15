import { useState } from "react";
import { toast } from "sonner";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { divTheme } from "./theme";
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
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);

  const need = spread.size;
  const ready = question.trim().length > 0 && picked.length === need;
  const stepsLeft = maxSteps - steps.length;

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

  const drawCard = () => {
    if (busy || picked.length >= need) return;
    setDeck((d) => {
      if (!d.length) return d;
      setPicked((p) => [...p, d[0]]);
      return d.slice(1);
    });
  };

  const resetDraw = () => {
    setPicked([]);
    setDeck(shuffle(deckCards));
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

      setSteps((prev) => [
        ...prev,
        {
          step_no: data.step_no,
          question: data.question,
          cards: data.cards || [],
          answer: data.answer || "",
        },
      ]);
      setQuestion("");
      resetDraw();
      onBalanceChange();
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
    await api({ action: "close", dialog_id: dialogId });
    setClosed(true);
    toast.success("Диалог закрыт");
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
                <button
                  type="button"
                  onClick={drawCard}
                  disabled={busy}
                  className="flex h-[104px] w-[68px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#c9a84c]/40 bg-white/[0.04] text-[#c9a84c] transition hover:bg-white/[0.08] disabled:opacity-50"
                >
                  <Icon name="Plus" size={18} />
                  <span className="text-[10px]">Тянуть</span>
                </button>
              )}
            </div>
          </div>

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
                  Карты отвечают...
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
                onClick={closeDialog}
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

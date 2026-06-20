import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import LockedFormOverlay from "@/components/LockedFormOverlay";
import { useAuth } from "@/context/AuthContext";
import { useBalance } from "@/context/BalanceContext";
import { useNavigate } from "react-router-dom";
import { LENORMAND_COST } from "@/config/prices";
import html2canvas from "html2canvas";
import {
  HOUSE_NAMES,
  CARD_NAMES,
  PERIODS,
  GENDERS,
  SPHERES,
  PeriodKey,
  GenderKey,
  SphereKey,
} from "@/data/lenormand";

const AI_EDITOR_START =
  "https://functions.poehali.dev/6ddfd93a-b3ac-445f-a1bf-3327d6ba01d7";
const AI_EDITOR_STATUS =
  "https://functions.poehali.dev/487c8816-d661-4f43-a72d-112374006c7c";

const MODELS = [
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet (подробный)" },
  { value: "google/gemini-2.5-flash", label: "Gemini Flash (быстрый)" },
];

const POLLING_INTERVAL = 5000;
const TIMEOUT_SECONDS = 600;
const EMPTY_LAYOUT = () => Array(36).fill("");

export default function LenormandDivination() {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<PeriodKey>("now");
  const [gender, setGender] = useState<GenderKey>("female");
  const [spheres, setSpheres] = useState<SphereKey[]>(["all"]);
  const [comment, setComment] = useState("");
  const [model, setModel] = useState(MODELS[0].value);
  const [layout, setLayout] = useState<string[]>(EMPTY_LAYOUT());
  const [activeHouse, setActiveHouse] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [resultLayout, setResultLayout] = useState<string[]>([]);
  const [resultDate, setResultDate] = useState<string>("");
  const [downloaded, setDownloaded] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [warningAction, setWarningAction] = useState<"start" | "new">("start");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);

  const FORM_STORAGE_KEY = "lenormand_form_v1";

  // Восстановление полей формы при загрузке
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORM_STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.period) setPeriod(d.period);
        if (d.gender) setGender(d.gender);
        if (Array.isArray(d.spheres)) setSpheres(d.spheres);
        if (typeof d.comment === "string") setComment(d.comment);
        if (d.model) setModel(d.model);
        if (Array.isArray(d.layout) && d.layout.length === 36) setLayout(d.layout);
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Автосохранение полей формы
  useEffect(() => {
    try {
      localStorage.setItem(
        FORM_STORAGE_KEY,
        JSON.stringify({ period, gender, spheres, comment, model, layout })
      );
    } catch (e) {
      /* ignore */
    }
  }, [period, gender, spheres, comment, model, layout]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const toggleSphere = (key: SphereKey) => {
    setSpheres((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const filledCount = layout.filter((c) => c).length;

  const usedCardsSet = new Set(layout.filter(Boolean));

  const nextEmptyHouse = (from: number, current: string[]) => {
    for (let i = from; i < current.length; i++) {
      if (!current[i]) return i;
    }
    for (let i = 0; i < current.length; i++) {
      if (!current[i]) return i;
    }
    return -1;
  };

  // Клик по тегу карты: вставляем карту в активный дом, фокус на следующий пустой
  const placeCard = (card: string) => {
    if (usedCardsSet.has(card)) return;
    setLayout((prev) => {
      const next = [...prev];
      const target = !prev[activeHouse] ? activeHouse : nextEmptyHouse(0, prev);
      if (target === -1) return prev;
      next[target] = card;
      const after = nextEmptyHouse(target + 1, next);
      setActiveHouse(after === -1 ? target : after);
      return next;
    });
  };

  // Клик по дому: если есть карта — очищаем её, иначе делаем дом активным
  const onHouseClick = (houseIdx: number) => {
    if (layout[houseIdx]) {
      setLayout((prev) => {
        const next = [...prev];
        next[houseIdx] = "";
        return next;
      });
      setActiveHouse(houseIdx);
    } else {
      setActiveHouse(houseIdx);
    }
  };

  const clearLayout = () => {
    setLayout(EMPTY_LAYOUT());
    setActiveHouse(0);
  };

  const doNewReading = () => {
    setLayout(EMPTY_LAYOUT());
    setActiveHouse(0);
    setComment("");
    setResult(null);
    setResultLayout([]);
    setResultDate("");
    setDownloaded(true);
  };

  const newReading = () => {
    if (result && !downloaded) {
      setWarningAction("new");
      setShowWarning(true);
      return;
    }
    doNewReading();
  };

  const startReading = useCallback(async () => {
    if (filledCount === 0) {
      toast.error("Выберите хотя бы одну карту в раскладе");
      return;
    }

    setIsProcessing(true);
    setStatusText("Отправляю расклад...");
    setResult(null);

    const meta = {
      system: "lenormand",
      spread: "big9x4",
      period,
      gender,
      spheres,
      comment: comment.trim(),
      layout,
    };

    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch(AI_EDITOR_START, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Session-Token": token } : {}),
        },
        body: JSON.stringify({
          task_type: "lenormand",
          model,
          divination_meta: meta,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Войдите, чтобы сделать расклад");
          navigate("/login");
        } else if (res.status === 402) {
          toast.error(`Недостаточно средств. Нужно ${LENORMAND_COST} ₽`);
          navigate("/profile/wallet");
        } else {
          toast.error(data.error || "Ошибка запуска");
        }
        setIsProcessing(false);
        return;
      }

      refreshBalance();
      pollStatus(data.task_id, [...layout]);
    } catch (e) {
      setIsProcessing(false);
      toast.error("Ошибка соединения");
    }
  }, [filledCount, period, gender, spheres, comment, model, layout, navigate, refreshBalance]);

  const pollStatus = (taskId: string, submittedLayout: string[]) => {
    let elapsed = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      elapsed += POLLING_INTERVAL / 1000;
      setStatusText(`Карты раскрываются... ${elapsed} сек`);
      try {
        const res = await fetch(`${AI_EDITOR_STATUS}?task_id=${taskId}`);
        const data = await res.json();
        if (data.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsProcessing(false);
          setStatusText("");
          setResult(data.ai_response || "");
          setResultLayout(submittedLayout);
          setResultDate(
            new Date().toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          );
          setDownloaded(false);
          refreshBalance();
          toast.success("Расклад готов!");
        } else if (data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsProcessing(false);
          setStatusText("");
          refreshBalance();
          toast.error(
            (data.error || "Не удалось сделать расклад") +
              ". Средства возвращены на баланс."
          );
        }
        if (elapsed > TIMEOUT_SECONDS) {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsProcessing(false);
          setStatusText("");
          toast.error("Превышено время ожидания");
        }
      } catch (e) {
        // network blip — keep polling
      }
    }, POLLING_INTERVAL);
  };

  const onSubmitClick = () => {
    if (result && !downloaded) {
      setWarningAction("start");
      setShowWarning(true);
      return;
    }
    startReading();
  };

  const downloadPng = async () => {
    if (!resultCardRef.current) return;
    try {
      const canvas = await html2canvas(resultCardRef.current, {
        backgroundColor: "#faf7ff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `lenormand-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setDownloaded(true);
    } catch (e) {
      toast.error("Не удалось сохранить картинку");
    }
  };

  const copyText = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      toast.success("Текст скопирован");
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
            <Icon name="Sparkles" size={28} className="text-purple-600" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Гадания на картах Ленорман
          </h1>
          <p className="mt-2 text-gray-600">
            Большой расклад 9 × 4 — медитативный взгляд на вашу ситуацию
          </p>
        </div>

        <LockedFormOverlay cost={LENORMAND_COST}>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Левая колонка — параметры */}
            <Card className="md:col-span-1">
              <CardContent className="space-y-5 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Период
                  </label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODS.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Кто спрашивает
                  </label>
                  <Select value={gender} onValueChange={(v) => setGender(v as GenderKey)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => (
                        <SelectItem key={g.key} value={g.key}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Сферы (можно несколько)
                  </label>
                  <div className="space-y-1.5">
                    {SPHERES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggleSphere(s.key)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                          spheres.includes(s.key)
                            ? "border-purple-500 bg-purple-50 text-purple-800"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Icon
                          name={spheres.includes(s.key) ? "CheckCircle2" : "Circle"}
                          size={16}
                          className={spheres.includes(s.key) ? "text-purple-600" : "text-gray-400"}
                        />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Комментарий (необязательно)
                  </label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Например: стоит ли обновить гардероб этой весной и каким будет мой новый образ…"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Толкование
                  </label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Правая колонка — стол расклада */}
            <Card className="md:col-span-2">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Стол расклада
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      Заполнено: {filledCount}/36
                    </span>
                    <Button variant="ghost" size="sm" onClick={clearLayout}>
                      <Icon name="Eraser" size={16} className="mr-1" /> Очистить
                    </Button>
                  </div>
                </div>
                <p className="mb-4 text-sm text-gray-500">
                  Выберите дом (он подсветится), затем кликните карту из списка ниже.
                  Клик по заполненному дому очищает его.
                </p>

                {/* Дома-плитки */}
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-9">
                  {HOUSE_NAMES.map((house, idx) => {
                    const card = layout[idx];
                    const isActive = activeHouse === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onHouseClick(idx)}
                        className={`flex min-h-[58px] flex-col rounded-lg border p-1.5 text-left transition ${
                          isActive
                            ? "border-purple-500 ring-2 ring-purple-300"
                            : card
                            ? "border-purple-200 bg-white"
                            : "border-dashed border-gray-300 bg-gray-50 hover:border-purple-300"
                        }`}
                      >
                        <span className="text-[10px] leading-tight text-purple-400">
                          {idx + 1}. {house}
                        </span>
                        <span
                          className={`mt-auto text-xs font-medium ${
                            card ? "text-purple-800" : "text-gray-300"
                          }`}
                        >
                          {card || "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Теги карт */}
                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Карты колоды
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CARD_NAMES.filter((card) => !usedCardsSet.has(card)).map(
                      (card) => (
                        <button
                          key={card}
                          type="button"
                          onClick={() => placeCard(card)}
                          className="rounded-full border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs text-purple-700 transition hover:bg-purple-100"
                        >
                          {card}
                        </button>
                      )
                    )}
                    {usedCardsSet.size === CARD_NAMES.length && (
                      <span className="text-xs text-gray-400">
                        Все карты разложены
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <Button
                    onClick={onSubmitClick}
                    disabled={isProcessing}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    {isProcessing ? (
                      <>
                        <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                        {statusText || "Обработка…"}
                      </>
                    ) : (
                      <>
                        <Icon name="Sparkles" size={18} className="mr-2" />
                        Разложить ({LENORMAND_COST} ₽)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </LockedFormOverlay>

        {/* Результат */}
        {result && (
          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={newReading}>
                <Icon name="RotateCcw" size={16} className="mr-1" /> Новый расклад
              </Button>
              <Button variant="outline" onClick={copyText}>
                <Icon name="Copy" size={16} className="mr-1" /> Скопировать
              </Button>
              <Button
                onClick={downloadPng}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                <Icon name="Download" size={16} className="mr-1" /> Скачать PNG
              </Button>
            </div>

            <div
              ref={resultCardRef}
              className="rounded-2xl border border-purple-100 p-6 shadow-sm"
              style={{ background: "linear-gradient(180deg, #faf7ff 0%, #f3eefc 100%)" }}
            >
              <div className="mb-4 text-center">
                <h2 className="text-2xl font-semibold text-purple-800">
                  Большой расклад Ленорман 9 × 4
                </h2>
                <p className="mt-1 text-sm text-purple-500">{resultDate}</p>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:grid-cols-9">
                {resultLayout.map((card, idx) =>
                  card ? (
                    <div
                      key={idx}
                      className="rounded-md border border-purple-200 bg-white/70 p-1.5 text-center"
                    >
                      <div className="text-[10px] text-purple-400">
                        {idx + 1}. {HOUSE_NAMES[idx]}
                      </div>
                      <div className="text-xs font-medium text-purple-800">
                        {card}
                      </div>
                    </div>
                  ) : null
                )}
              </div>

              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
                {result}
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сохраните предыдущий расклад</AlertDialogTitle>
            <AlertDialogDescription>
              Скачай, чтоб не потерять предыдущий расклад, иначе он не сохранится.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowWarning(false);
                if (warningAction === "new") {
                  doNewReading();
                } else {
                  startReading();
                }
              }}
            >
              Всё равно продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
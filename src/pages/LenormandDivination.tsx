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
import {
  LENORMAND_AI,
  LENORMAND_SPREAD,
  getDivinationPrice,
  getDivinationMinPrice,
} from "@/config/prices";
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
import {
  CARD_BACK_IMAGE,
  getCardImageByName,
} from "@/data/lenormandImages";

const AI_EDITOR_START =
  "https://functions.poehali.dev/6ddfd93a-b3ac-445f-a1bf-3327d6ba01d7";
const AI_EDITOR_STATUS =
  "https://functions.poehali.dev/487c8816-d661-4f43-a72d-112374006c7c";
const LENORMAND_LAST =
  "https://functions.poehali.dev/9d61578b-0a21-4bba-9fcc-37dbd5a4454d";
const IMAGE_PROXY =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

// Кэш data-url картинок карт (чтобы не дёргать прокси повторно при скачивании)
const cardDataUrlCache = new Map<string, string>();

// Возвращает картинку как data-url через прокси (с CORS), кэширует результат
const fetchCardDataUrl = async (url: string): Promise<string | null> => {
  if (cardDataUrlCache.has(url)) return cardDataUrlCache.get(url)!;
  try {
    const res = await fetch(`${IMAGE_PROXY}?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data_url) {
      cardDataUrlCache.set(url, data.data_url);
      return data.data_url;
    }
    return null;
  } catch {
    return null;
  }
};

// Перед снимком PNG заменяем src карт на data-url (через прокси),
// чтобы html2canvas мог их захватить без CORS-ошибки.
const inlineCardImages = async (root: HTMLElement) => {
  const imgs = Array.from(
    root.querySelectorAll<HTMLImageElement>('img[data-card-img="1"]')
  );
  await Promise.all(
    imgs.map(async (img) => {
      if (img.src.startsWith("data:")) return;
      const dataUrl = await fetchCardDataUrl(img.src);
      if (dataUrl) img.src = dataUrl;
    })
  );
};

const MODELS = LENORMAND_AI;
const LENORMAND_MIN_COST = getDivinationMinPrice(LENORMAND_SPREAD);

const POLLING_INTERVAL = 5000;
const TIMEOUT_SECONDS = 600;
const EMPTY_LAYOUT = () => Array(36).fill("");

// Заголовки шагов мастера настройки расклада
const WIZARD_TITLES = [
  "Способ расклада",
  "Система карт",
  "Расклад",
  "Нейросеть-гадалка",
  "Пол",
  "Период",
  "Сферы",
  "Комментарий",
];
const WIZARD_STEPS_COUNT = WIZARD_TITLES.length;
const TAROT_BACK_IMAGE =
  "https://storage.yandexcloud.net/fitting-room-images/images/tarot/000.png";

type Mode = "online" | "real";

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function LenormandDivination() {
  const { user } = useAuth();
  const { refreshBalance, balanceInfo } = useBalance();
  const navigate = useNavigate();

  // Доступность модели по балансу: безлимит — всё доступно;
  // иначе модель доступна, если её цены хватает на балансе.
  const hasUnlimited = balanceInfo?.unlimited_access === true;
  const currentBalance = balanceInfo?.balance ?? 0;
  const isModelAffordable = (modelValue: string) => {
    if (hasUnlimited) return true;
    return currentBalance >= getDivinationPrice(LENORMAND_SPREAD, modelValue);
  };

  const [period, setPeriod] = useState<PeriodKey>("now");
  const [gender, setGender] = useState<GenderKey>("female");
  const [spheres, setSpheres] = useState<SphereKey[]>(["all"]);
  const [comment, setComment] = useState("");
  const [model, setModel] = useState(MODELS[0].value);
  const selectedCost = getDivinationPrice(LENORMAND_SPREAD, model);
  const [layout, setLayout] = useState<string[]>(EMPTY_LAYOUT());
  const [activeHouse, setActiveHouse] = useState<number>(0);

  const [mode, setMode] = useState<Mode>("online");
  const [deck, setDeck] = useState<string[]>(() => shuffleArray(CARD_NAMES));
  const [shuffled, setShuffled] = useState(false);

  // Пошаговый мастер настройки расклада
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardDone, setWizardDone] = useState(false);
  const [divSystem, setDivSystem] = useState<"lenormand" | "tarot">("lenormand");
  const [divSpread, setDivSpread] = useState("big9x4");

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [resultLayout, setResultLayout] = useState<string[]>([]);
  const [resultDate, setResultDate] = useState<string>("");
  const [downloaded, setDownloaded] = useState(true);

  // Модалка «первое касание нового расклада, пока есть старый результат»
  const [showTouchWarning, setShowTouchWarning] = useState(false);
  const [touchAck, setTouchAck] = useState(false);
  // Аккордион «Предыдущий расклад»
  const [prevOpen, setPrevOpen] = useState(false);

  // Предыдущий расклад из базы (последний завершённый) — для показа после перезагрузки
  const [prevResult, setPrevResult] = useState<string | null>(null);
  const [prevLayout, setPrevLayout] = useState<string[]>([]);
  const [prevDate, setPrevDate] = useState<string>("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const prevCardRef = useRef<HTMLDivElement>(null);
  const dbPrevCardRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const FORM_STORAGE_KEY = "lenormand_form_v1";
  // Восстанавливать форму из localStorage можно только после проверки наличия
  // предыдущего результата (если он есть — форма должна стартовать чистой).
  const [formReady, setFormReady] = useState(false);

  // Восстановление полей формы из localStorage
  const restoreFormFromStorage = () => {
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
        if (typeof d.wizardStep === "number") setWizardStep(d.wizardStep);
        if (typeof d.wizardDone === "boolean") setWizardDone(d.wizardDone);
        if (d.divSystem === "lenormand" || d.divSystem === "tarot") setDivSystem(d.divSystem);
        if (typeof d.divSpread === "string") setDivSpread(d.divSpread);
      }
    } catch (e) {
      /* ignore */
    }
  };

  // Автосохранение полей формы (только после первичной инициализации)
  useEffect(() => {
    if (!formReady) return;
    try {
      localStorage.setItem(
        FORM_STORAGE_KEY,
        JSON.stringify({
          period,
          gender,
          spheres,
          comment,
          model,
          layout,
          wizardStep,
          wizardDone,
          divSystem,
          divSpread,
        })
      );
    } catch (e) {
      /* ignore */
    }
  }, [
    formReady,
    period,
    gender,
    spheres,
    comment,
    model,
    layout,
    wizardStep,
    wizardDone,
    divSystem,
    divSpread,
  ]);

  // Если выбранная гадалка стала недоступна по балансу — переключаем на
  // самую дешёвую доступную (первая в списке — самая дешёвая).
  useEffect(() => {
    if (!balanceInfo || hasUnlimited) return;
    if (isModelAffordable(model)) return;
    const affordable = MODELS.find((m) => isModelAffordable(m.value));
    if (affordable && affordable.value !== model) {
      setModel(affordable.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceInfo, model]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Загрузка последнего завершённого расклада из базы (показ в аккордионе после перезагрузки)
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("session_token");

    const finishWithEmpty = () => {
      if (cancelled) return;
      restoreFormFromStorage();
      setFormReady(true);
    };

    if (!token) {
      finishWithEmpty();
      return;
    }

    (async () => {
      try {
        const res = await fetch(LENORMAND_LAST, {
          headers: { "X-Session-Token": token },
        });
        if (!res.ok) {
          finishWithEmpty();
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.empty || !data.ai_response) {
          finishWithEmpty();
          return;
        }
        const meta = data.divination_meta || {};
        const layoutArr =
          Array.isArray(meta.layout) && meta.layout.length === 36
            ? meta.layout
            : [];
        setPrevResult(data.ai_response);
        setPrevLayout(layoutArr);
        setPrevDate(
          data.created_at
            ? new Date(data.created_at).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : ""
        );
        // Форму НЕ обнуляем при обновлении страницы — восстанавливаем
        // сохранённые поля, даже если есть прошлый результат из базы.
        restoreFormFromStorage();
        setFormReady(true);
      } catch (e) {
        finishWithEmpty();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Есть любой предыдущий результат: свежий (из сессии) или подтянутый из базы
  const hasPrevResult = !!result || !!prevResult;

  // Перехват первого касания формы нового расклада, пока есть старый результат
  const guardTouch = (): boolean => {
    if (hasPrevResult && !touchAck) {
      setShowTouchWarning(true);
      return true; // блокируем действие
    }
    return false;
  };

  const toggleSphere = (key: SphereKey) => {
    if (isProcessing) return;
    if (guardTouch()) return;
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

  // Реальный расклад: клик по тегу карты
  const placeCard = (card: string) => {
    if (isProcessing) return;
    if (guardTouch()) return;
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

  // Онлайн-расклад: перемешать колоду (подготовка перед раскладом)
  const shuffleDeck = () => {
    if (isProcessing) return;
    if (guardTouch()) return;
    const remaining = CARD_NAMES.filter((c) => !usedCardsSet.has(c));
    setDeck(shuffleArray(remaining));
    setShuffled(true);
    if (layout[activeHouse]) {
      const e = nextEmptyHouse(0, layout);
      setActiveHouse(e === -1 ? 0 : e);
    }
    toast.success("Карты перемешаны — выбирайте карту для дома");
  };

  // Онлайн-расклад: тянем карту вслепую (берём верхнюю из колоды)
  const drawBlindCard = () => {
    if (isProcessing) return;
    if (guardTouch()) return;
    if (!shuffled) {
      toast.info("Сначала перемешайте карты");
      return;
    }
    if (deck.length === 0) return;
    setLayout((prev) => {
      const target = !prev[activeHouse] ? activeHouse : nextEmptyHouse(0, prev);
      if (target === -1) return prev;
      const card = deck[0];
      const next = [...prev];
      next[target] = card;
      setDeck((d) => d.slice(1));
      const after = nextEmptyHouse(target + 1, next);
      setActiveHouse(after === -1 ? target : after);
      return next;
    });
  };

  // Клик по дому
  const onHouseClick = (houseIdx: number) => {
    if (isProcessing) return;
    if (guardTouch()) return;
    if (mode === "online" && !shuffled) {
      toast.info("Сначала перемешайте карты");
      return;
    }
    if (layout[houseIdx]) {
      const removed = layout[houseIdx];
      setLayout((prev) => {
        const next = [...prev];
        next[houseIdx] = "";
        return next;
      });
      if (mode === "online") {
        setDeck((d) => [...d, removed]);
      }
      setActiveHouse(houseIdx);
    } else {
      setActiveHouse(houseIdx);
    }
  };

  const resetTable = () => {
    setLayout(EMPTY_LAYOUT());
    setActiveHouse(0);
    setDeck(shuffleArray(CARD_NAMES));
    setShuffled(false);
  };

  const clearLayout = () => {
    if (isProcessing) return;
    if (guardTouch()) return;
    resetTable();
  };

  // Очистить форму и начать новый расклад: сбрасывает все поля, стол,
  // сохранённую форму в localStorage и предыдущий результат.
  const clearAll = () => {
    if (isProcessing) return;
    setPeriod("now");
    setGender("female");
    setSpheres(["all"]);
    setComment("");
    setModel(MODELS[0].value);
    resetTable();
    setWizardStep(0);
    setWizardDone(false);
    setDivSystem("lenormand");
    setDivSpread("big9x4");
    setTouchAck(false);
    setShowTouchWarning(false);
    setResult(null);
    setResultLayout([]);
    setResultDate("");
    setDownloaded(true);
    setPrevResult(null);
    setPrevLayout([]);
    setPrevDate("");
    setPrevOpen(false);
    try {
      localStorage.removeItem(FORM_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    toast.success("Форма очищена — можно начинать новый расклад");
  };

  // Полный сброс старого результата (после запуска нового расклада)
  const dropPrevResult = () => {
    setResult(null);
    setResultLayout([]);
    setResultDate("");
    setDownloaded(true);
    setPrevResult(null);
    setPrevLayout([]);
    setPrevDate("");
    setPrevOpen(false);
    setTouchAck(false);
  };

  // Скачать показанный результат: свежий (из сессии) или из базы
  const downloadShownPng = () => {
    if (result) {
      downloadPng();
    } else if (prevResult) {
      downloadPrevPng();
    }
  };

  // «Очистить форму и начать новый расклад» — всё обновляет (до перезагрузки)
  const startNewReadingNow = () => {
    if (isProcessing) return;
    dropPrevResult();
    setPeriod("now");
    setGender("female");
    setSpheres(["all"]);
    setComment("");
    setModel(MODELS[0].value);
    resetTable();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startReading = useCallback(async () => {
    if (filledCount === 0) {
      toast.error("Выберите хотя бы одну карту в раскладе");
      return;
    }

    // Запуск нового расклада — старый результат удаляется безвозвратно
    dropPrevResult();

    setIsProcessing(true);
    setStatusText("Отправляю расклад...");

    // Скролл к лоадеру
    setTimeout(() => {
      loaderRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);

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
          toast.error(`Недостаточно средств. Нужно ${selectedCost} ₽`);
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
  }, [filledCount, period, gender, spheres, comment, model, layout, navigate, refreshBalance, selectedCost]);

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
          // Появился свежий результат — прячем «предыдущий из базы»
          setPrevResult(null);
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
          setTimeout(() => {
            resultCardRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 80);
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

  // Дожидаемся полной загрузки всех картинок внутри блока,
  // иначе html2canvas сделает снимок без изображений карт.
  const waitForImages = async (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
      )
    );
  };

  const downloadPng = async () => {
    if (!prevCardRef.current) return;
    try {
      await inlineCardImages(prevCardRef.current);
      await waitForImages(prevCardRef.current);
      const canvas = await html2canvas(prevCardRef.current, {
        backgroundColor: "#faf7ff",
        scale: 2,
        useCORS: true,
        imageTimeout: 15000,
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

  // Скачивание/копирование для «предыдущего расклада из базы»
  const downloadPrevPng = async () => {
    if (!dbPrevCardRef.current) return;
    try {
      await inlineCardImages(dbPrevCardRef.current);
      await waitForImages(dbPrevCardRef.current);
      const canvas = await html2canvas(dbPrevCardRef.current, {
        backgroundColor: "#faf7ff",
        scale: 2,
        useCORS: true,
        imageTimeout: 15000,
      });
      const link = document.createElement("a");
      link.download = `lenormand-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      toast.error("Не удалось сохранить картинку");
    }
  };

  const copyPrevText = () => {
    if (prevResult) {
      navigator.clipboard.writeText(prevResult);
      toast.success("Текст скопирован");
    }
  };

  const switchMode = (m: Mode) => {
    if (isProcessing) return;
    if (m === mode) return;
    if (guardTouch()) return;
    setMode(m);
    resetTable();
  };

  const houseLocked = mode === "online" && !shuffled;
  const formDisabled = isProcessing;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
            <Icon name="Sparkles" size={28} className="text-purple-600" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Гадания на картах онлайн с ИИ
          </h1>
          <p className="mt-2 text-gray-600">
            Большой расклад 9 × 4 — медитативный взгляд на вашу ситуацию
          </p>
        </div>

        <LockedFormOverlay cost={LENORMAND_MIN_COST}>
          {/* Кнопка очистки всей формы и начала нового расклада */}
          <div className="mb-4 flex justify-center">
            <Button
              variant="outline"
              onClick={clearAll}
              disabled={formDisabled}
            >
              <Icon name="RotateCcw" size={16} className="mr-1.5" />
              Очистить форму и начать новый расклад
            </Button>
          </div>

          {/* МАСТЕР НАСТРОЙКИ РАСКЛАДА (показывается, пока не завершён) */}
          {!wizardDone && (
            <Card className="mb-6">
              <CardContent className="p-5">
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-600">
                      Шаг {wizardStep + 1} из {WIZARD_STEPS_COUNT}
                    </span>
                    <span className="text-xs text-gray-400">
                      {wizardStep + 1}/{WIZARD_STEPS_COUNT}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-purple-600 transition-all"
                      style={{
                        width: `${((wizardStep + 1) / WIZARD_STEPS_COUNT) * 100}%`,
                      }}
                    />
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-gray-900">
                    {WIZARD_TITLES[wizardStep]}
                  </h2>
                </div>

                <fieldset
                  disabled={formDisabled}
                  className={formDisabled ? "pointer-events-none opacity-60" : ""}
                >
                  {/* Шаг 0: Способ расклада (Онлайн/Реальный) */}
                  {wizardStep === 0 && (
                    <div>
                      <div className="mb-4 inline-flex rounded-lg border border-gray-200 p-1">
                        <button
                          type="button"
                          onClick={() => switchMode("online")}
                          disabled={formDisabled}
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                            mode === "online"
                              ? "bg-purple-600 text-white"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          Онлайн-расклад
                        </button>
                        <button
                          type="button"
                          onClick={() => switchMode("real")}
                          disabled={formDisabled}
                          className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                            mode === "real"
                              ? "bg-purple-600 text-white"
                              : "text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          Реальный расклад
                        </button>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <b className="text-gray-800">Онлайн-расклад</b> — перемешайте
                          колоду и тяните карты рубашкой вверх прямо на экране.
                        </p>
                        <p>
                          <b className="text-gray-800">Реальный расклад</b> — у вас уже
                          разложены настоящие карты, вы просто переносите их в дома.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Шаг 1: Система карт */}
                  {wizardStep === 1 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setDivSystem("lenormand")}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition ${
                          divSystem === "lenormand"
                            ? "border-purple-500 bg-purple-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <Icon name="Sparkles" size={28} className="text-purple-600" />
                        <span className="font-semibold text-gray-900">Ленорман</span>
                        <span className="text-xs text-gray-500">
                          36 карт, большой расклад 9 × 4
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled
                        className="flex cursor-not-allowed flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-5 text-center opacity-70"
                      >
                        <img
                          src={TAROT_BACK_IMAGE}
                          alt="Таро"
                          className="h-14 w-auto rounded object-contain"
                          loading="lazy"
                        />
                        <span className="flex items-center gap-2 font-semibold text-gray-600">
                          Таро
                          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                            Скоро
                          </span>
                        </span>
                        <span className="text-xs text-gray-400">
                          Скоро будет доступно
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Шаг 2: Расклад */}
                  {wizardStep === 2 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setDivSpread("big9x4")}
                        className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                          divSpread === "big9x4"
                            ? "border-purple-500 bg-purple-50 text-purple-800"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Большой 9 × 4
                      </button>
                      {["1 карта", "3 карты", "Большой 8×4+4"].map((label) => (
                        <button
                          key={label}
                          type="button"
                          disabled
                          className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-500 opacity-70"
                        >
                          {label}
                          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                            Скоро
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Шаг 3: Нейросеть-гадалка */}
                  {wizardStep === 3 && (
                    <div>
                      <Select value={model} onValueChange={(v) => { if (guardTouch()) return; setModel(v); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODELS.map((m) => {
                            const price = getDivinationPrice(LENORMAND_SPREAD, m.value);
                            const affordable = isModelAffordable(m.value);
                            return (
                              <SelectItem
                                key={m.value}
                                value={m.value}
                                disabled={!affordable}
                              >
                                <span className="flex flex-col">
                                  <span>
                                    {m.label} — {price} ₽
                                    {!affordable && " (не хватает баланса)"}
                                  </span>
                                  <span className="text-xs text-gray-500">{m.desc}</span>
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="mt-1.5 text-xs text-gray-500">
                        3 нейросети-гадалки — цена расклада от {LENORMAND_MIN_COST} до{" "}
                        {getDivinationPrice(LENORMAND_SPREAD, MODELS[MODELS.length - 1].value)} ₽
                      </p>
                    </div>
                  )}

                  {/* Шаг 4: Пол */}
                  {wizardStep === 4 && (
                    <Select value={gender} onValueChange={(v) => { if (guardTouch()) return; setGender(v as GenderKey); }}>
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
                  )}

                  {/* Шаг 5: Период */}
                  {wizardStep === 5 && (
                    <Select value={period} onValueChange={(v) => { if (guardTouch()) return; setPeriod(v as PeriodKey); }}>
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
                  )}

                  {/* Шаг 6: Сферы */}
                  {wizardStep === 6 && (
                    <div className="flex flex-wrap gap-2">
                      {SPHERES.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => toggleSphere(s.key)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
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
                  )}

                  {/* Шаг 7: Комментарий */}
                  {wizardStep === 7 && (
                    <Textarea
                      value={comment}
                      onChange={(e) => { if (guardTouch()) return; setComment(e.target.value); }}
                      placeholder="Например: стоит ли обновить гардероб этой весной и каким будет мой новый образ…"
                      rows={3}
                    />
                  )}
                </fieldset>

                {/* Навигация мастера */}
                <div className="mt-6 flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                    disabled={wizardStep === 0 || formDisabled}
                  >
                    <Icon name="ArrowLeft" size={16} className="mr-1.5" />
                    Назад
                  </Button>
                  {wizardStep === WIZARD_STEPS_COUNT - 1 ? (
                    <Button
                      onClick={() => setWizardDone(true)}
                      disabled={formDisabled}
                      className="bg-purple-600 text-white hover:bg-purple-700"
                    >
                      <Icon name="Check" size={16} className="mr-1.5" />
                      Готово
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        setWizardStep((s) => Math.min(WIZARD_STEPS_COUNT - 1, s + 1))
                      }
                      disabled={formDisabled}
                      className="bg-purple-600 text-white hover:bg-purple-700"
                    >
                      Далее
                      <Icon name="ArrowRight" size={16} className="ml-1.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* СВОДКА + СТОЛ РАСКЛАДА (после завершения мастера) */}
          {wizardDone && (
          <>
          <Card className="mb-6">
            <CardContent className="p-5">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Параметры расклада
              </h2>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div className="flex flex-col">
                  <dt className="text-xs text-gray-500">Способ</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {mode === "online" ? "Онлайн-расклад" : "Реальный расклад"}
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-gray-500">Система</dt>
                  <dd className="text-sm font-medium text-gray-900">Ленорман</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-gray-500">Расклад</dt>
                  <dd className="text-sm font-medium text-gray-900">Большой 9 × 4</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-gray-500">Гадалка</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {MODELS.find((m) => m.value === model)?.label} —{" "}
                    {getDivinationPrice(LENORMAND_SPREAD, model)} ₽
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-gray-500">Пол</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {GENDERS.find((g) => g.key === gender)?.label}
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs text-gray-500">Период</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {PERIODS.find((p) => p.key === period)?.label}
                  </dd>
                </div>
                <div className="flex flex-col sm:col-span-2">
                  <dt className="text-xs text-gray-500">Сферы</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {SPHERES.filter((s) => spheres.includes(s.key))
                      .map((s) => s.label)
                      .join(", ")}
                  </dd>
                </div>
                <div className="flex flex-col sm:col-span-2">
                  <dt className="text-xs text-gray-500">Комментарий</dt>
                  <dd className="whitespace-pre-wrap text-sm font-medium text-gray-900">
                    {comment.trim() || "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWizardDone(false);
                    setWizardStep(0);
                  }}
                  disabled={formDisabled}
                >
                  <Icon name="Pencil" size={16} className="mr-1.5" />
                  Редактировать
                </Button>
                <Button
                  variant="outline"
                  onClick={clearAll}
                  disabled={formDisabled}
                >
                  <Icon name="RotateCcw" size={16} className="mr-1.5" />
                  Очистить и начать заново
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Стол расклада — ниже на всю ширину */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Стол расклада
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    Заполнено: {filledCount}/36
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearLayout}
                    disabled={formDisabled}
                  >
                    <Icon name="Eraser" size={16} className="mr-1" /> Очистить расклад
                  </Button>
                </div>
              </div>

              {/* Пояснения над вкладками */}
              <div className="mb-3 space-y-1 text-sm text-gray-600">
                <p>
                  <b className="text-gray-800">Онлайн-расклад</b> — перемешайте
                  колоду и тяните карты рубашкой вверх прямо на экране.
                </p>
                <p>
                  <b className="text-gray-800">Реальный расклад</b> — у вас уже
                  разложены настоящие карты, вы просто переносите их в дома.
                </p>
              </div>

              {/* Переключатель режимов */}
              <div className="mb-4 inline-flex rounded-lg border border-gray-200 p-1">
                <button
                  type="button"
                  onClick={() => switchMode("online")}
                  disabled={formDisabled}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                    mode === "online"
                      ? "bg-purple-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Онлайн-расклад
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("real")}
                  disabled={formDisabled}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                    mode === "real"
                      ? "bg-purple-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Реальный расклад
                </button>
              </div>

              {/* УПРАВЛЕНИЕ И ПОДСКАЗКИ — НАД СТОЛОМ */}
              <div
                className={`mb-4 rounded-xl border border-purple-100 bg-purple-50/40 p-4 ${
                  formDisabled ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {mode === "online" ? (
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      size="lg"
                      onClick={shuffleDeck}
                      disabled={formDisabled}
                      className="bg-purple-600 px-8 py-6 text-base text-white hover:bg-purple-700"
                    >
                      <Icon name="Shuffle" size={22} className="mr-2" />
                      Перемешать карты
                    </Button>
                    {shuffled ? (
                      <p className="text-center text-sm text-gray-600">
                        Активный дом: «{activeHouse + 1}. {HOUSE_NAMES[activeHouse]}».
                        Кликните любую карту-рубашку <b>в колоде ниже</b> — она
                        ляжет в дом.
                      </p>
                    ) : (
                      <p className="text-center text-sm text-gray-600">
                        Перемешайте карты, чтобы начать. Колода рубашками —{" "}
                        <b>ниже под столом</b>.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-600">
                    Выберите дом, затем кликните карту, которая выпала в реальном
                    раскладе. Список карт — <b>ниже под столом</b>.
                  </p>
                )}
              </div>

              {/* Дома-плитки на «столе гадалки» */}
              <div
                className="overflow-x-auto rounded-2xl border border-purple-200 p-3 sm:p-4"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 0%, #ede9fe 0%, #ddd6fe 55%, #c7bdf4 100%)",
                  boxShadow:
                    "inset 0 0 50px rgba(124,58,237,0.18), inset 0 0 6px rgba(124,58,237,0.12)",
                }}
              >
                <div className="grid min-w-[760px] grid-cols-9 gap-1.5">
                  {HOUSE_NAMES.map((house, idx) => {
                  const card = layout[idx];
                  const isActive = activeHouse === idx && !houseLocked;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onHouseClick(idx)}
                      disabled={formDisabled}
                      className={`flex min-h-[64px] flex-col rounded-lg border p-1.5 text-left transition disabled:cursor-not-allowed ${
                        isActive
                          ? "border-purple-500 ring-2 ring-purple-300"
                          : card
                          ? "border-purple-200 bg-white/60"
                          : "border-dashed border-gray-300 bg-white/40 hover:border-purple-300"
                      } ${houseLocked || formDisabled ? "opacity-60" : ""}`}
                    >
                      <span className="text-[10px] leading-tight text-purple-700">
                        {idx + 1}. дом {house}
                      </span>
                      {card && getCardImageByName(card) && (
                        <img
                          src={getCardImageByName(card)}
                          alt={card}
                          className="mx-auto mt-1 h-24 w-[62px] rounded object-contain sm:h-32 sm:w-[82px]"
                          loading="lazy"
                        />
                      )}
                      <span
                        className={`mt-auto flex min-h-[28px] items-end text-[11px] font-semibold leading-tight sm:text-xs ${
                          card ? "text-purple-900" : "text-gray-400"
                        }`}
                      >
                        {card ? `карта ${card}` : "—"}
                      </span>
                    </button>
                  );
                  })}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-400 lg:hidden">
                <Icon name="ArrowLeft" size={14} />
                <span>Листайте стол вбок, чтобы увидеть все 36 домов</span>
                <Icon name="ArrowRight" size={14} />
              </div>

              {/* ОНЛАЙН: колода рубашкой вверх (под столом) */}
              {mode === "online" && shuffled && (
                <div
                  className={`mt-6 ${formDisabled ? "pointer-events-none opacity-60" : ""}`}
                >
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Колода (рубашкой вверх)
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {deck.map((card, i) => (
                      <button
                        key={`${card}-${i}`}
                        type="button"
                        onClick={drawBlindCard}
                        disabled={formDisabled}
                        title="Вытянуть карту"
                        className="h-24 w-[62px] overflow-hidden rounded-md border border-purple-300 shadow-sm transition hover:-translate-y-1 sm:h-32 sm:w-[82px]"
                      >
                        <img
                          src={CARD_BACK_IMAGE}
                          alt="Рубашка карты"
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </button>
                    ))}
                    {deck.length === 0 && (
                      <span className="text-sm text-gray-400">
                        Все карты разложены
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* РЕАЛЬНЫЙ: теги карт (под столом) */}
              {mode === "real" && (
                <div
                  className={`mt-6 ${formDisabled ? "pointer-events-none opacity-60" : ""}`}
                >
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Карты колоды
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CARD_NAMES.filter((c) => !usedCardsSet.has(c)).map((card) => (
                      <button
                        key={card}
                        type="button"
                        onClick={() => placeCard(card)}
                        disabled={formDisabled}
                        className="flex items-center gap-1.5 rounded-full border border-purple-300 bg-purple-50 py-1 pl-1 pr-2.5 text-sm text-purple-700 transition hover:bg-purple-100"
                      >
                        {getCardImageByName(card) && (
                          <img
                            src={getCardImageByName(card)}
                            alt={card}
                            className="h-8 w-8 rounded-full object-cover"
                            loading="lazy"
                          />
                        )}
                        {card}
                      </button>
                    ))}
                    {usedCardsSet.size === CARD_NAMES.length && (
                      <span className="text-sm text-gray-400">
                        Все карты разложены
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center gap-3">
                <Button
                  onClick={startReading}
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
                      Разложить ({selectedCost} ₽)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          </>
          )}

          {/* ЛОАДЕР под столом во время обработки */}
          {isProcessing && (
            <div
              ref={loaderRef}
              className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-purple-100 bg-purple-50/40 py-12"
            >
              <Icon
                name="Loader2"
                size={40}
                className="mb-4 animate-spin text-purple-500"
              />
              <p className="text-base font-medium text-purple-700">
                {statusText || "Карты раскрываются…"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Это может занять до минуты. Не закрывайте страницу.
              </p>
            </div>
          )}
        </LockedFormOverlay>

        {/* ТОЛЬКО ТЕКСТ результата под столом */}
        {result && !isProcessing && (
          <div className="mt-8" ref={resultCardRef}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-purple-800">
                Толкование расклада
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={copyText}>
                  <Icon name="Copy" size={16} className="mr-1" /> Скопировать
                </Button>
                <Button
                  onClick={downloadPng}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  <Icon name="Download" size={16} className="mr-1" /> Скачать PNG
                </Button>
                <Button variant="outline" onClick={startNewReadingNow}>
                  <Icon name="RotateCcw" size={16} className="mr-1" /> Очистить
                  форму и начать новый расклад
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
              <p className="mb-3 text-sm text-purple-500">{resultDate}</p>
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
                {result}
              </div>
            </div>
          </div>
        )}

        {/* Предыдущий расклад из базы (после перезагрузки, пока нет свежего) */}
        {prevResult && !result && !isProcessing && (
          <div className="mt-8 rounded-2xl border border-purple-100">
            <button
              type="button"
              onClick={() => setPrevOpen((o) => !o)}
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <span className="font-medium text-gray-900">Предыдущий расклад</span>
              <Icon
                name={prevOpen ? "ChevronUp" : "ChevronDown"}
                size={20}
                className="text-gray-500"
              />
            </button>
            {prevOpen && (
              <div className="border-t border-purple-100 p-5">
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <Icon name="TriangleAlert" size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Этот расклад удалится, как только вы запустите новый.
                    Рекомендуем скачать картинку или скопировать текст к себе.
                  </span>
                </div>
                <div className="mb-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyPrevText}>
                    <Icon name="Copy" size={16} className="mr-1" /> Скопировать
                  </Button>
                  <Button
                    size="sm"
                    onClick={downloadPrevPng}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    <Icon name="Download" size={16} className="mr-1" /> Скачать PNG
                  </Button>
                </div>

                <div
                  className="rounded-2xl border border-purple-100 p-6 shadow-sm"
                  style={{
                    background:
                      "linear-gradient(180deg, #faf7ff 0%, #f3eefc 100%)",
                  }}
                >
                  <div className="mb-4 text-center">
                    <h3 className="text-2xl font-semibold text-purple-800">
                      Большой расклад Ленорман 9 × 4
                    </h3>
                    <p className="mt-1 text-sm text-purple-500">{prevDate}</p>
                  </div>

                  {prevLayout.length === 36 && (
                    <div
                      className="mb-6 overflow-x-auto rounded-2xl border border-purple-200 p-3 sm:p-4"
                      style={{
                        background:
                          "radial-gradient(120% 100% at 50% 0%, #ede9fe 0%, #ddd6fe 55%, #c7bdf4 100%)",
                        boxShadow:
                          "inset 0 0 50px rgba(124,58,237,0.18), inset 0 0 6px rgba(124,58,237,0.12)",
                      }}
                    >
                      <div className="grid min-w-[760px] grid-cols-9 gap-1.5">
                        {prevLayout.map((card, idx) =>
                          card ? (
                            <div
                              key={idx}
                              className="rounded-md border border-purple-200 bg-white/60 p-1.5 text-center"
                            >
                              <div className="text-[10px] leading-tight text-purple-700">
                                {idx + 1}. дом {HOUSE_NAMES[idx]}
                              </div>
                              {getCardImageByName(card) && (
                                <img
                                  src={getCardImageByName(card)}
                                  alt={card}
                                  className="mx-auto my-1 h-24 w-[62px] rounded object-contain sm:h-32 sm:w-[82px]"
                                  loading="lazy"
                                />
                              )}
                              <div className="text-[11px] font-semibold leading-tight text-purple-900 sm:text-xs">
                                карта {card}
                              </div>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
                    {prevResult}
                  </div>
                  <div className="mt-6 border-t border-purple-200 pt-4 text-center text-xs text-purple-400">
                    <p>
                      Трактовки раскладов носят
                      развлекательно-информационно-рекомендательный характер,
                      создаются нейросетью, мы не несём ответственность за текст
                      ответа нейросети.
                    </p>
                    <p className="mt-1 font-medium text-purple-500">
                      fitting-room.ru
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Дисклеймер */}
        <div className="mt-10 flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <Icon name="Info" size={20} className="mt-0.5 shrink-0 text-amber-600" />
          <p>
            Трактовки раскладов носят развлекательно-информационно-рекомендательный
            характер, создаются нейросетью, мы не несём ответственность за текст
            ответа нейросети.
          </p>
        </div>

        <p className="mt-6 text-center text-sm font-medium text-purple-500">
          fitting-room.ru
        </p>
      </div>

      {/* Скрытая копия карточки для скачивания PNG (всегда в DOM, пока есть результат) */}
      {result && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: "-10000px",
            top: 0,
            width: "900px",
            pointerEvents: "none",
          }}
        >
          <div
            ref={prevCardRef}
            className="rounded-2xl border border-purple-100 p-6 shadow-sm"
            style={{
              background: "linear-gradient(180deg, #faf7ff 0%, #f3eefc 100%)",
            }}
          >
            <div className="mb-4 text-center">
              <h3 className="text-2xl font-semibold text-purple-800">
                Большой расклад Ленорман 9 × 4
              </h3>
              <p className="mt-1 text-sm text-purple-500">{resultDate}</p>
            </div>
            <div
              className="mb-6 grid grid-cols-9 gap-1.5 rounded-2xl border border-purple-200 p-4"
              style={{
                background:
                  "radial-gradient(120% 100% at 50% 0%, #ede9fe 0%, #ddd6fe 55%, #c7bdf4 100%)",
                boxShadow:
                  "inset 0 0 50px rgba(124,58,237,0.18), inset 0 0 6px rgba(124,58,237,0.12)",
              }}
            >
              {resultLayout.map((card, idx) =>
                card ? (
                  <div
                    key={idx}
                    className="rounded-md border border-purple-200 bg-white/60 p-1.5 text-center"
                  >
                    <div className="text-xs text-purple-700">
                      {idx + 1}. дом {HOUSE_NAMES[idx]}
                    </div>
                    {getCardImageByName(card) && (
                      <img
                        src={getCardImageByName(card)}
                        alt={card}
                        data-card-img="1"
                        className="mx-auto my-1 h-32 w-[82px] rounded object-contain"
                      />
                    )}
                    <div className="text-sm font-semibold text-purple-900">
                      карта {card}
                    </div>
                  </div>
                ) : null
              )}
            </div>
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
              {result}
            </div>
            <div className="mt-6 border-t border-purple-200 pt-4 text-center text-xs text-purple-400">
              <p>
                Трактовки раскладов носят
                развлекательно-информационно-рекомендательный характер,
                создаются нейросетью, мы не несём ответственность за текст ответа
                нейросети.
              </p>
              <p className="mt-1 font-medium text-purple-500">fitting-room.ru</p>
            </div>
          </div>
        </div>
      )}

      {/* Скрытая копия предыдущего расклада из базы для скачивания PNG */}
      {prevResult && !result && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: "-10000px",
            top: 0,
            width: "900px",
            pointerEvents: "none",
          }}
        >
          <div
            ref={dbPrevCardRef}
            className="rounded-2xl border border-purple-100 p-6 shadow-sm"
            style={{
              background: "linear-gradient(180deg, #faf7ff 0%, #f3eefc 100%)",
            }}
          >
            <div className="mb-4 text-center">
              <h3 className="text-2xl font-semibold text-purple-800">
                Большой расклад Ленорман 9 × 4
              </h3>
              <p className="mt-1 text-sm text-purple-500">{prevDate}</p>
            </div>
            {prevLayout.length === 36 && (
              <div
                className="mb-6 grid grid-cols-9 gap-1.5 rounded-2xl border border-purple-200 p-4"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 0%, #ede9fe 0%, #ddd6fe 55%, #c7bdf4 100%)",
                  boxShadow:
                    "inset 0 0 50px rgba(124,58,237,0.18), inset 0 0 6px rgba(124,58,237,0.12)",
                }}
              >
                {prevLayout.map((card, idx) =>
                  card ? (
                    <div
                      key={idx}
                      className="rounded-md border border-purple-200 bg-white/60 p-1.5 text-center"
                    >
                      <div className="text-xs text-purple-700">
                        {idx + 1}. дом {HOUSE_NAMES[idx]}
                      </div>
                      {getCardImageByName(card) && (
                        <img
                          src={getCardImageByName(card)}
                          alt={card}
                          data-card-img="1"
                          className="mx-auto my-1 h-32 w-[82px] rounded object-contain"
                        />
                      )}
                      <div className="text-sm font-semibold text-purple-900">
                        карта {card}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            )}
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
              {prevResult}
            </div>
            <div className="mt-6 border-t border-purple-200 pt-4 text-center text-xs text-purple-400">
              <p>
                Трактовки раскладов носят
                развлекательно-информационно-рекомендательный характер,
                создаются нейросетью, мы не несём ответственность за текст ответа
                нейросети.
              </p>
              <p className="mt-1 font-medium text-purple-500">fitting-room.ru</p>
            </div>
          </div>
        </div>
      )}

      {/* Модалка при первом касании нового расклада */}
      <AlertDialog open={showTouchWarning} onOpenChange={setShowTouchWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы начинаете новый расклад</AlertDialogTitle>
            <AlertDialogDescription>
              Старый результат удалится, как только вы запустите новый. Рекомендуем
              скачать его. Можно скачать прямо сейчас или начать новый расклад без
              сохранения.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowTouchWarning(false);
                setTouchAck(true);
                dropPrevResult();
              }}
            >
              Начать новый расклад
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowTouchWarning(false);
                setTouchAck(true);
                downloadShownPng();
              }}
            >
              Скачать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
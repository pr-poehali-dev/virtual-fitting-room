import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
const loadHtml2Canvas = async () => (await import("html2canvas")).default;
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
import { getSpread, spreadsByDeck, type DeckId } from "@/data/divination/spreads";
import { getDeck } from "@/data/divination/decks";
import {
  getTarotImageByName,
  TAROT_BACK_IMAGE as TAROT_BACK,
} from "@/data/divination/tarotImages";
import { divTheme } from "@/components/divination/theme";
import SpreadTable from "@/components/divination/SpreadTable";
import OptionGrid from "@/components/divination/OptionGrid";
import SpreadSummary from "@/components/divination/SpreadSummary";
import DivinationTabs, { type DivTab } from "@/components/divination/DivinationTabs";
import SavedDialogs, { type SavedDialog } from "@/components/divination/SavedDialogs";
import DialogChat from "@/components/divination/DialogChat";
import { DIALOG_MAX_STEPS } from "@/config/prices";

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
const EMPTY_LAYOUT = (size = 36) => Array(size).fill("");

// Заголовки шагов мастера настройки расклада
// Полный набор шагов мастера. Для раскладов-диалогов сферы и комментарий
// не спрашиваем: там человек формулирует вопрос прямо в диалоге.
const WIZARD_TITLES_FULL = [
  "Способ расклада",
  "Система карт",
  // Гадалка идёт ДО расклада: цена расклада зависит от выбранной гадалки
  "Нейросеть-гадалка",
  "Расклад",
  "Пол",
  "Период",
  "Сферы",
  "Комментарий",
];
const WIZARD_TITLES_DIALOG = WIZARD_TITLES_FULL.slice(0, 6);

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
  // Форма заблокирована балансовым/авторизационным оверлеем (как в LockedFormOverlay):
  // нет пользователя ИЛИ не безлимит и баланса не хватает на минимальную цену.
  const isLockedByBalanceOrAuth =
    !user || (!hasUnlimited && currentBalance < LENORMAND_MIN_COST);

  const [period, setPeriod] = useState<PeriodKey>("now");
  const [gender, setGender] = useState<GenderKey>("female");
  const [spheres, setSpheres] = useState<SphereKey[]>(["all"]);
  const [comment, setComment] = useState("");
  const [model, setModel] = useState(MODELS[0].value);
  const [layout, setLayout] = useState<string[]>(EMPTY_LAYOUT());
  const [activeHouse, setActiveHouse] = useState<number>(0);

  const [mode, setMode] = useState<Mode>("online");
  const [deck, setDeck] = useState<string[]>(() => shuffleArray(CARD_NAMES));
  const [shuffled, setShuffled] = useState(false);

  // Пошаговый мастер настройки расклада
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardDone, setWizardDone] = useState(false);
  const [divSystem, setDivSystem] = useState<"lenormand" | "tarot">("lenormand");
  const [divSpread, setDivSpread] = useState("lenormand_big9x4");
  // Настройки диалога: сколько карт на вопрос и как берём колоду
  const [cardsPerStep, setCardsPerStep] = useState(1);
  const [deckMode, setDeckMode] = useState<"full" | "single">("full");
  // Вкладка раздела: обычные расклады или диалоги
  const [tab, setTab] = useState<DivTab>("spreads");
  const [savedReload, setSavedReload] = useState(0);
  // Диалог, к которому вернулись из списка сохранённых
  const [resumeDialog, setResumeDialog] = useState<SavedDialog | null>(null);

  // Активный расклад и колода — из реестра (единый источник правды)
  const activeSpread = getSpread(divSpread) ?? getSpread("lenormand_big9x4")!;
  const activeDeck = getDeck(divSystem as DeckId);
  const spreadSize = activeSpread.size;
  // Карты активной колоды (Ленорман/Таро)
  const deckCards = activeDeck.cards;
  // Набор шагов зависит от типа расклада
  const WIZARD_TITLES = activeSpread.dialog
    ? WIZARD_TITLES_DIALOG
    : WIZARD_TITLES_FULL;
  const WIZARD_STEPS_COUNT = WIZARD_TITLES.length;
  // Картинки карт есть только у колоды Ленорман. Для Таро изображение не
  // подставляем, иначе совпадающие названия (Луна, Башня, Солнце) подтянут
  // чужую картинку из колоды Ленорман.
  // Картинка карты берётся из своей колоды: у Ленорман и Таро есть карты
  // с одинаковыми названиями (Луна, Башня, Солнце) — их нельзя перепутать.
  const getDeckCardImage = (name: string) =>
    divSystem === "lenormand"
      ? getCardImageByName(name)
      : getTarotImageByName(name);
  // Рубашка колоды — своя для каждой системы карт
  const deckBackImage = divSystem === "lenormand" ? CARD_BACK_IMAGE : TAROT_BACK;
  const selectedCost = getDivinationPrice(divSpread, model);
  // Доступность гадалки считаем по цене ВЫБРАННОГО расклада
  // (у диалогов шаг стоит дешевле полного расклада).
  const isModelAffordable = (modelValue: string) => {
    if (hasUnlimited) return true;
    return currentBalance >= getDivinationPrice(divSpread, modelValue);
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [resultLayout, setResultLayout] = useState<string[]>([]);
  const [resultDate, setResultDate] = useState<string>("");
  const [downloaded, setDownloaded] = useState(true);

  // Подтверждение «у меня есть несохранённый результат, начинаю новый»
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
        if (Array.isArray(d.layout) && d.layout.length > 0) setLayout(d.layout);
        if (typeof d.wizardStep === "number") setWizardStep(d.wizardStep);
        if (typeof d.wizardDone === "boolean") setWizardDone(d.wizardDone);
        if (d.divSystem === "lenormand" || d.divSystem === "tarot") setDivSystem(d.divSystem);
        if (typeof d.divSpread === "string") {
          // Старые сохранённые формы хранят короткий id ("big9x4") —
          // переводим в новый полный id, иначе не сойдётся цена расклада.
          const legacy: Record<string, string> = {
            big9x4: "lenormand_big9x4",
            line3: "lenormand_line3",
            card1: "lenormand_card1",
          };
          const restored = legacy[d.divSpread] || d.divSpread;
          setDivSpread(getSpread(restored) ? restored : "lenormand_big9x4");
        }
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
        // Раскладов теперь много (3, 10, 36 карт) — берём любую непустую раскладку
        const layoutArr =
          Array.isArray(meta.layout) && meta.layout.length > 0 ? meta.layout : [];
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
  // В режиме диалога сохранённый большой расклад не показываем:
  // он относится к другому сценарию и сбивает с толку.
  const hasPrevResult =
    !activeSpread.dialog && (!!result || !!prevResult);

  const toggleSphere = (key: SphereKey) => {
    if (isProcessing) return;
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
    const remaining = deckCards.filter((c) => !usedCardsSet.has(c));
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
    setLayout(EMPTY_LAYOUT(spreadSize));
    setActiveHouse(0);
    setDeck(shuffleArray(deckCards));
    setShuffled(false);
  };

  const clearLayout = () => {
    if (isProcessing) return;
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
      toast.error("Выложите хотя бы одну карту в раскладе");
      return;
    }
    // Большой расклад читается только целиком
    if (activeSpread.requireFull && filledCount < spreadSize) {
      toast.error(
        `Для этого расклада нужно выложить все ${spreadSize} карт. Сейчас ${filledCount}.`,
      );
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
      system: divSystem,
      spread: divSpread,
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
  }, [filledCount, period, gender, spheres, comment, model, layout, navigate, refreshBalance, selectedCost, divSystem, divSpread, activeSpread, spreadSize]);

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
      const html2canvas = await loadHtml2Canvas();
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
      const html2canvas = await loadHtml2Canvas();
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
    setMode(m);
    resetTable();
  };

  // Страховка: если у диалога шагов меньше, не зависаем на несуществующем шаге
  useEffect(() => {
    setWizardStep((prev) =>
      prev > WIZARD_STEPS_COUNT - 1 ? WIZARD_STEPS_COUNT - 1 : prev,
    );
  }, [WIZARD_STEPS_COUNT]);

  // Страховка: длина стола всегда соответствует выбранному раскладу
  // (например, после восстановления старой формы из браузера).
  useEffect(() => {
    setLayout((prev) => {
      if (prev.length === spreadSize) return prev;
      const next = EMPTY_LAYOUT(spreadSize);
      for (let i = 0; i < Math.min(prev.length, spreadSize); i++) next[i] = prev[i];
      return next;
    });
    setActiveHouse((prev) => (prev >= spreadSize ? 0 : prev));
  }, [spreadSize]);

  // Сколько колонок рисовать для готового расклада (по количеству карт)
  const resultCols = (len: number) => {
    if (len >= 36) return 9;
    if (len >= 10) return 5;
    if (len >= 3) return len;
    return 1;
  };

  // Можно ли уйти с текущего шага мастера дальше.
  // Шаг «Расклад» и «Сферы» требуют явного выбора.
  const spreadsOnTab = spreadsByDeck(divSystem as DeckId).filter((sp) =>
    tab === "dialogs" ? sp.dialog : !sp.dialog,
  );
  const spreadChosen = spreadsOnTab.some((sp) => sp.id === divSpread);
  const stepBlockReason = (() => {
    const title = WIZARD_TITLES[wizardStep];
    if (title === "Расклад" && !spreadChosen) return "Выберите расклад";
    if (title === "Сферы" && spheres.length === 0)
      return "Выберите хотя бы одну сферу";
    return "";
  })();

  // Большие расклады (9x4, 8x4+4) читаются только целиком:
  // цепочки по рядам и столбцам без полной выкладки не работают.
  const needFullTable = activeSpread.requireFull === true;
  const tableReady = needFullTable
    ? filledCount === spreadSize
    : filledCount > 0;
  const tableHint = needFullTable
    ? `Выложите все ${spreadSize} карт — заполнено ${filledCount}`
    : "Выложите хотя бы одну карту";

  const houseLocked = mode === "online" && !shuffled;
  const formDisabled = isProcessing;

  return (
    <Layout>
      {/* Тема раздела применяется ТОЛЬКО к контентному блоку:
          шапка сайта, боковое меню и футер остаются прежними.
          Фон тянется на всю ширину области контента, чтобы тёмный блок
          не выглядел «заплаткой» на белом. */}
      <div className={`min-h-screen ${divTheme.surface}`}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${divTheme.accentSoft}`}>
            <Icon name="Sparkles" size={28} className="text-[#c9a84c]" />
          </div>
          <h1 className={`text-3xl sm:text-4xl ${divTheme.title}`}>
            Гадания на картах онлайн с ИИ
          </h1>
          <p className={`mt-2 ${divTheme.muted}`}>
            Выберите расклад и нейросеть-гадалку — получите подробное толкование за минуту
          </p>
        </div>

        {/* Две категории: расклады и диалоги — со своими правилами хранения */}
        <DivinationTabs
          value={tab}
          onChange={(next) => {
            setTab(next);
            const list = spreadsByDeck(divSystem as DeckId).filter((sp) =>
              next === "dialogs" ? sp.dialog : !sp.dialog,
            );
            if (list.length && !list.some((sp) => sp.id === divSpread)) {
              setDivSpread(list[0].id);
              setLayout(EMPTY_LAYOUT(list[0].size));
            }
            setWizardDone(false);
            setWizardStep(0);
            setResumeDialog(null);
          }}
        />

        {tab === "dialogs" && (
          <SavedDialogs
            reloadKey={savedReload}
            onContinue={(d) => {
              setDivSystem(d.system as DeckId);
              setDivSpread(d.spread);
              setCardsPerStep(d.cards_per_step || 1);
              setDeckMode((d.deck_mode as "full" | "single") || "full");
              setResumeDialog(d);
              setWizardDone(true);
            }}
          />
        )}

        <LockedFormOverlay cost={LENORMAND_MIN_COST}>
          <div className="relative">
          {/* Блокировка всей формы, пока есть несохранённый прошлый результат.
              Если форма уже закрыта балансовым/авторизационным оверлеем —
              наш оверлей не показываем (новый расклад без баланса всё равно нельзя). */}
          {hasPrevResult && !touchAck && !isLockedByBalanceOrAuth && (
            <div className="absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-[#1a1030]/70 backdrop-blur-sm">
              <div className="mx-4 mt-10 max-w-sm rounded-2xl bg-[#241845] p-6 text-center shadow-xl ring-1 ring-[#c9a84c]/30">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#c9a84c]/15">
                  <Icon name="Sparkles" size={28} className="text-[#c9a84c]" />
                </div>
                <h3 className="mb-1 text-lg font-semibold text-[#f3ecff]">
                  У вас есть готовый расклад
                </h3>
                <p className="mb-4 text-sm text-[#c9bfe0]">
                  Скачайте его, если нужно — после начала нового расклада он будет
                  удалён.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      setTouchAck(true);
                      downloadShownPng();
                    }}
                    className="bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a]"
                  >
                    <Icon name="Download" size={16} className="mr-1.5" />
                    Скачать результат
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTouchAck(true);
                      dropPrevResult();
                    }}
                    className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                  >
                    <Icon name="RotateCcw" size={16} className="mr-1.5" />
                    Начать новый расклад
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* МАСТЕР НАСТРОЙКИ РАСКЛАДА (показывается, пока не завершён) */}
          {!wizardDone && (
            <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-[#2d1b69] via-[#241845] to-[#1a1030] text-white shadow-lg ring-1 ring-[#c9a84c]/25">
              <CardContent className="p-6">
                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-white/90">
                      Шаг {wizardStep + 1} из {WIZARD_STEPS_COUNT}
                    </span>
                    <span className="text-xs text-white/70">
                      {wizardStep + 1}/{WIZARD_STEPS_COUNT}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#e8c252] transition-all"
                      style={{
                        width: `${((wizardStep + 1) / WIZARD_STEPS_COUNT) * 100}%`,
                      }}
                    />
                  </div>
                  <h2 className="mt-3 font-serif text-2xl text-[#f3ecff]">
                    {WIZARD_TITLES[wizardStep]}
                  </h2>
                </div>

                <fieldset
                  disabled={formDisabled}
                  className={`flex min-h-[168px] items-start rounded-2xl border border-white/15 bg-white/10 p-5 ${
                    formDisabled ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  <div key={wizardStep} className="w-full animate-fade-in">
                  {/* Шаг 0: Способ расклада (Онлайн/Реальный) */}
                  {wizardStep === 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          key: "online" as Mode,
                          title: "Онлайн-расклад",
                          desc: "Перемешайте колоду и тяните карты рубашкой вверх прямо на экране.",
                        },
                        {
                          key: "real" as Mode,
                          title: "Реальный расклад",
                          desc: "У вас уже разложены настоящие карты — вы просто переносите их в дома.",
                        },
                      ].map((opt) => {
                        const active = mode === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => switchMode(opt.key)}
                            disabled={formDisabled}
                            className={`flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition disabled:opacity-50 ${
                              active
                                ? "border-white bg-white/15"
                                : "border-white/40 hover:border-white"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon
                                name={active ? "CircleDot" : "Circle"}
                                size={16}
                                className="shrink-0 text-white"
                              />
                              <span className="font-semibold text-white">
                                {opt.title}
                              </span>
                            </span>
                            <span className="text-xs leading-relaxed text-white/75">
                              {opt.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Шаг 1: Система карт */}
                  {wizardStep === 1 && (
                    <OptionGrid
                      columns={2}
                      value={divSystem}
                      onChange={(v) => {
                        const next = v as DeckId;
                        setDivSystem(next);
                        // Расклад должен принадлежать и выбранной колоде,
                        // и текущей вкладке (расклады / диалоги)
                        const list = spreadsByDeck(next).filter((sp) =>
                          tab === "dialogs" ? sp.dialog : !sp.dialog,
                        );
                        if (list.length && !list.some((sp) => sp.id === divSpread)) {
                          setDivSpread(list[0].id);
                          setLayout(EMPTY_LAYOUT(list[0].size));
                        }
                        setDeck(shuffleArray(getDeck(next).cards));
                        setShuffled(false);
                      }}
                      options={[
                        {
                          value: "lenormand",
                          label: "Ленорман",
                          desc: "36 карт, конкретика и бытовые ситуации",
                          icon: "Spade",
                        },
                        {
                          value: "tarot",
                          label: "Таро",
                          desc: "78 карт, глубокий образный разбор",
                          icon: "Sparkles",
                        },
                      ]}
                    />
                  )}

                  {/* Шаг 3: Расклад */}
                  {wizardStep === 3 && (
                    <OptionGrid
                      columns={2}
                      value={divSpread}
                      onChange={(v) => {
                        setDivSpread(v);
                        const sp = getSpread(v);
                        if (sp) setLayout(EMPTY_LAYOUT(sp.size));
                        setActiveHouse(0);
                      }}
                      options={spreadsByDeck(divSystem as DeckId)
                        .filter((sp) =>
                          tab === "dialogs" ? sp.dialog : !sp.dialog,
                        )
                        .map((sp) => ({
                        value: sp.id,
                        label: sp.title,
                        // Сразу видно, можно ли вести диалог с картами
                        desc: sp.dialog
                          ? `${sp.short}. Режим диалога: можно задавать уточняющие вопросы`
                          : `${sp.short}. Одно подробное толкование, без диалога`,
                        icon: sp.icon,
                        badge: sp.dialog ? "Диалог" : undefined,
                        note: sp.dialog
                          ? `${getDivinationPrice(sp.id, model)} \u20bd/вопрос`
                          : `${getDivinationPrice(sp.id, model)} \u20bd`,
                        }))}
                    />
                  )}

                  {/* Настройки диалога — только для диалоговых раскладов */}
                  {wizardStep === 3 && activeSpread.dialog && (
                    <div className="mt-5 space-y-5">
                      <div>
                        <p className="mb-2 text-sm font-medium text-white">
                          Сколько карт тянуть на один вопрос
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setCardsPerStep(n)}
                              className={`h-11 w-11 rounded-xl border-2 text-sm font-semibold transition ${
                                cardsPerStep === n
                                  ? "border-[#c9a84c] bg-[#c9a84c]/20 text-white"
                                  : "border-white/40 text-white/80 hover:border-white"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-white/70">
                          Больше карт — подробнее ответ. Цена за вопрос не меняется.
                        </p>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium text-white">
                          Как берём колоду
                        </p>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setDeckMode("full")}
                            className={`rounded-xl border-2 p-3 text-left transition ${
                              deckMode === "full"
                                ? "border-[#c9a84c] bg-[#c9a84c]/15"
                                : "border-white/40 hover:border-white"
                            }`}
                          >
                            <span className="block font-medium text-white">
                              Каждый вопрос — полная колода
                            </span>
                            <span className="mt-0.5 block text-xs text-white/70">
                              Перед каждым вопросом колода собирается заново.
                              Карты могут повторяться, вопросы независимы.
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeckMode("single")}
                            className={`rounded-xl border-2 p-3 text-left transition ${
                              deckMode === "single"
                                ? "border-[#c9a84c] bg-[#c9a84c]/15"
                                : "border-white/40 hover:border-white"
                            }`}
                          >
                            <span className="block font-medium text-white">
                              Одна колода на весь диалог
                            </span>
                            <span className="mt-0.5 block text-xs text-white/70">
                              Выпавшие карты не возвращаются. Разговор идёт,
                              пока не кончатся карты или лимит вопросов.
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Шаг 2: Нейросеть-гадалка */}
                  {wizardStep === 2 && (
                    <div>
                      <div
                        role="radiogroup"
                        className="grid gap-2.5 sm:grid-cols-3"
                      >
                        {MODELS.map((m) => {
                          const price = getDivinationPrice(divSpread, m.value);
                          const affordable = isModelAffordable(m.value);
                          const selected = model === m.value;
                          return (
                            <button
                              key={m.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              disabled={!affordable}
                              onClick={() => setModel(m.value)}
                              className={`flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                selected
                                  ? "border-white bg-white/15"
                                  : "border-white/40 hover:border-white"
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-white">
                                  {m.label}
                                </span>
                                <Icon
                                  name={selected ? "CircleDot" : "Circle"}
                                  size={18}
                                  className="shrink-0 text-white"
                                />
                              </span>
                              <span className="text-sm font-medium text-white/90">
                                {price} ₽
                              </span>
                              <span className="text-xs text-white/75">{m.desc}</span>
                              {!affordable && (
                                <span className="text-xs text-white/90">
                                  не хватает баланса
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2.5 text-xs text-white/80">
                        {activeSpread.dialog
                          ? `Цена одного вопроса в диалоге: ${getDivinationPrice(divSpread, MODELS[0].value)}–${getDivinationPrice(divSpread, MODELS[MODELS.length - 1].value)} \u20bd`
                          : `Цена расклада: ${getDivinationPrice(divSpread, MODELS[0].value)}–${getDivinationPrice(divSpread, MODELS[MODELS.length - 1].value)} \u20bd`}
                      </p>
                    </div>
                  )}

                  {/* Шаг 4: Пол */}
                  {wizardStep === 4 && (
                    <div className="flex flex-wrap gap-2">
                      {GENDERS.map((g) => {
                        const active = gender === g.key;
                        return (
                          <button
                            key={g.key}
                            type="button"
                            onClick={() => setGender(g.key as GenderKey)}
                            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition ${
                              active
                                ? "border-white bg-white/15 text-white"
                                : "border-white/40 text-white/80 hover:border-white hover:text-white"
                            }`}
                          >
                            <Icon
                              name={active ? "CircleDot" : "Circle"}
                              size={16}
                              className="text-white"
                            />
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Шаг 5: Период */}
                  {wizardStep === 5 && (
                    <div className="flex flex-wrap gap-2">
                      {PERIODS.map((p) => {
                        const active = period === p.key;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setPeriod(p.key as PeriodKey)}
                            className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition ${
                              active
                                ? "border-white bg-white/15 text-white"
                                : "border-white/40 text-white/80 hover:border-white hover:text-white"
                            }`}
                          >
                            <Icon
                              name={active ? "CircleDot" : "Circle"}
                              size={16}
                              className="text-white"
                            />
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Шаг 6: Сферы */}
                  {wizardStep === 6 && (
                    <div className="flex flex-wrap gap-2">
                      {SPHERES.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => toggleSphere(s.key)}
                          className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition ${
                            spheres.includes(s.key)
                              ? "border-white bg-white/15 text-white"
                              : "border-white/40 text-white/80 hover:border-white hover:text-white"
                          }`}
                        >
                          <Icon
                            name={spheres.includes(s.key) ? "CheckCircle2" : "Circle"}
                            size={16}
                            className="text-white"
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
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Например: стоит ли обновить гардероб этой весной и каким будет мой новый образ…"
                      rows={3}
                      className="border-2 border-white/50 bg-transparent text-white placeholder:text-white/60 focus-visible:ring-white/40"
                    />
                  )}
                  </div>
                </fieldset>

                {/* Навигация мастера */}
                <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-5">
                  <button
                    type="button"
                    onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                    disabled={wizardStep === 0 || formDisabled}
                    className="inline-flex items-center rounded-xl border-2 border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-40"
                  >
                    <Icon name="ArrowLeft" size={16} className="mr-1.5" />
                    Назад
                  </button>

                  {stepBlockReason && (
                    <span className="order-last w-full text-center text-sm text-[#e8d9a8] sm:order-none sm:w-auto">
                      {stepBlockReason}
                    </span>
                  )}
                  {wizardStep === WIZARD_STEPS_COUNT - 1 ? (
                    <button
                      type="button"
                      onClick={() => setWizardDone(true)}
                      disabled={formDisabled || !!stepBlockReason}
                      title={stepBlockReason || undefined}
                      className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#c9a84c] to-[#e8c252] px-6 py-2.5 text-sm font-semibold text-[#1a1030] shadow-lg transition hover:from-[#d8b75b] hover:to-[#f0cf6a] disabled:opacity-40"
                    >
                      <Icon name="Check" size={16} className="mr-1.5" />
                      Готово
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setWizardStep((s) => Math.min(WIZARD_STEPS_COUNT - 1, s + 1))
                      }
                      disabled={formDisabled || !!stepBlockReason}
                      title={stepBlockReason || undefined}
                      className="inline-flex items-center rounded-xl bg-gradient-to-r from-[#c9a84c] to-[#e8c252] px-6 py-2.5 text-sm font-semibold text-[#1a1030] shadow-lg transition hover:from-[#d8b75b] hover:to-[#f0cf6a] disabled:opacity-40"
                    >
                      Далее
                      <Icon name="ArrowRight" size={16} className="ml-1.5" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* СВОДКА + СТОЛ РАСКЛАДА (после завершения мастера) */}
          {/* Расклады-диалоги идут отдельным сценарием: вопрос → карты → ответ */}
          {wizardDone && activeSpread.dialog && (
            <SpreadSummary
              mode={mode}
              spreadTitle={activeSpread.title}
              modelLabel={MODELS.find((m) => m.value === model)?.label || ""}
              cost={selectedCost}
              costSuffix=" за вопрос"
              genderLabel={GENDERS.find((g) => g.key === gender)?.label || ""}
              periodLabel={PERIODS.find((pd) => pd.key === period)?.label || ""}
              spheresLabel={SPHERES.filter((sp) => spheres.includes(sp.key))
                .map((sp) => sp.label)
                .join(", ")}
              comment={comment}
              hideTopic
              disabled={false}
              onEdit={() => {
                setWizardDone(false);
                setWizardStep(0);
              }}
              onClearAll={clearAll}
            />
          )}

          {wizardDone && activeSpread.dialog && (
            <DialogChat
              key={`${divSpread}-${model}`}
              spread={activeSpread}
              deckCards={deckCards}
              backImage={deckBackImage}
              model={model}
              context={{ gender, period, spheres, comment: comment.trim() }}
              cardsPerStep={cardsPerStep}
              deckMode={deckMode}
              resumeDialog={resumeDialog}
              onDialogChanged={() => setSavedReload((k) => k + 1)}
              stepPrice={selectedCost}
              maxSteps={DIALOG_MAX_STEPS}
              getCardImage={getDeckCardImage}
              onBalanceChange={refreshBalance}
              onNeedTopup={() => navigate("/profile/wallet")}
            />
          )}

          {wizardDone && !activeSpread.dialog && (
          <>
          <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-[#2d1b69] via-[#241845] to-[#1a1030] text-white shadow-lg ring-1 ring-[#c9a84c]/25">
            <CardContent className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Параметры расклада
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[15px] leading-relaxed text-white">
                <span>
                  <span className="text-white/60">Способ:</span>{" "}
                  {mode === "online" ? "Онлайн-расклад" : "Реальный расклад"}
                </span>
                <span className="text-white/40">·</span>
                <span>
                  <span className="text-white/60">Расклад:</span> {activeSpread.title}
                </span>
                <span className="text-white/40">·</span>
                <span>
                  <span className="text-white/60">Гадалка:</span>{" "}
                  {MODELS.find((m) => m.value === model)?.label} —{" "}
                  {selectedCost} ₽
                </span>
                <span className="text-white/40">·</span>
                <span>
                  <span className="text-white/60">Пол:</span>{" "}
                  {GENDERS.find((g) => g.key === gender)?.label}
                </span>
                <span className="text-white/40">·</span>
                <span>
                  <span className="text-white/60">Период:</span>{" "}
                  {PERIODS.find((p) => p.key === period)?.label}
                </span>
                <span className="text-white/40">·</span>
                <span>
                  <span className="text-white/60">Сферы:</span>{" "}
                  {SPHERES.filter((s) => spheres.includes(s.key))
                    .map((s) => s.label)
                    .join(", ")}
                </span>
                <span className="text-white/40">·</span>
                <span>
                  <span className="text-white/60">Комментарий:</span>{" "}
                  {comment.trim() || "—"}
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWizardDone(false);
                    setWizardStep(0);
                  }}
                  disabled={formDisabled}
                  className="inline-flex items-center rounded-xl border-2 border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-40"
                >
                  <Icon name="Pencil" size={16} className="mr-1.5" />
                  Редактировать
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={formDisabled}
                  className="inline-flex items-center rounded-xl border-2 border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-40"
                >
                  <Icon name="RotateCcw" size={16} className="mr-1.5" />
                  Очистить всё и начать заново
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Стол расклада — ниже на всю ширину */}
          <Card className="border-0 bg-white/[0.04] ring-1 ring-[#c9a84c]/20">
            <CardContent className="p-5">
              {/* Заголовок, главное действие и счётчик — одной строкой.
                  На мобильном перестраивается в столбик. */}
              <div
                className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                  formDisabled ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <h2 className="font-serif text-lg text-[#f3ecff]">
                    Стол расклада
                  </h2>
                  <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs text-[#c9bfe0]">
                    {filledCount}/{spreadSize}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {mode === "online" && (
                    <Button
                      onClick={shuffleDeck}
                      disabled={formDisabled}
                      className="flex-1 bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a] sm:flex-none"
                    >
                      <Icon name="Shuffle" size={17} className="mr-1.5" />
                      Перемешать карты
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={clearLayout}
                    disabled={formDisabled}
                    className="flex-1 border border-white/25 text-[#e8e0f0] hover:bg-white/8 hover:text-white sm:flex-none"
                  >
                    <Icon name="Eraser" size={16} className="mr-1.5" />
                    Очистить
                  </Button>
                </div>
              </div>

              {/* Подсказка — одной строкой под панелью */}
              <p className="mb-4 text-sm text-[#9888b8]">
                {mode === "online"
                  ? shuffled
                    ? `Активный дом: ${activeHouse + 1}. ${HOUSE_NAMES[activeHouse]}. Кликните карту-рубашку в колоде под столом.`
                    : "Перемешайте карты, чтобы начать. Колода появится под столом."
                  : "Выберите дом, затем кликните карту, которая выпала в реальном раскладе. Список карт — под столом."}
              </p>

              {/* Стол расклада — геометрия берётся из реестра раскладов */}
              <SpreadTable
                spread={activeSpread}
                houseNames={activeDeck.houseNames}
                layout={layout}
                activeIndex={activeHouse}
                locked={houseLocked}
                disabled={formDisabled}
                onSlotClick={onHouseClick}
                getCardImage={getDeckCardImage}
              />

              {/* ОНЛАЙН: колода рубашкой вверх (под столом) */}
              {mode === "online" && shuffled && (
                <div
                  className={`mt-6 ${formDisabled ? "pointer-events-none opacity-60" : ""}`}
                >
                  <div className="mb-2 text-sm font-medium text-[#e8e0f0]">
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
                        className="h-24 w-[62px] overflow-hidden rounded-md border border-[#c9a84c]/35 shadow-sm transition hover:-translate-y-1 sm:h-32 sm:w-[82px]"
                      >
                        <img
                          src={deckBackImage}
                          alt="Рубашка карты"
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </button>
                    ))}
                    {deck.length === 0 && (
                      <span className="text-sm text-[#9888b8]">
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
                  <div className="mb-2 text-sm font-medium text-[#e8e0f0]">
                    Карты колоды
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {deckCards.filter((c) => !usedCardsSet.has(c)).map((card) => (
                      <button
                        key={card}
                        type="button"
                        onClick={() => placeCard(card)}
                        disabled={formDisabled}
                        className="flex items-center gap-1.5 rounded-full border border-[#c9a84c]/40 bg-[#c9a84c]/10 py-1 pl-1 pr-2.5 text-sm text-[#c9a84c] transition hover:bg-[#c9a84c]/20"
                      >
                        {getDeckCardImage(card) && (
                          <img
                            src={getDeckCardImage(card)}
                            alt={card}
                            className="h-8 w-8 rounded-full object-cover"
                            loading="lazy"
                          />
                        )}
                        {card}
                      </button>
                    ))}
                    {usedCardsSet.size === deckCards.length && (
                      <span className="text-sm text-[#9888b8]">
                        Все карты разложены
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  onClick={startReading}
                  disabled={isProcessing || !tableReady}
                  title={tableReady ? undefined : tableHint}
                  className="bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a]"
                >
                  {isProcessing ? (
                    <>
                      <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                      {statusText || "Обработка…"}
                    </>
                  ) : (
                    <>
                      <Icon name="Sparkles" size={18} className="mr-2" />
                      Трактовать с помощью ИИ ({selectedCost} ₽)
                    </>
                  )}
                </Button>

                {!tableReady && !isProcessing && (
                  <span className="text-sm text-[#e8d9a8]">{tableHint}</span>
                )}
              </div>
            </CardContent>
          </Card>
          </>
          )}

          {/* ЛОАДЕР под столом во время обработки */}
          {isProcessing && (
            <div
              ref={loaderRef}
              className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-[#c9a84c]/20 bg-white/[0.04] py-12"
            >
              <Icon
                name="Loader2"
                size={40}
                className="mb-4 animate-spin text-[#c9a84c]"
              />
              <p className="text-base font-medium text-[#c9a84c]">
                {statusText || "Карты раскрываются…"}
              </p>
              <p className="mt-1 text-sm text-[#9888b8]">
                Это может занять до минуты. Не закрывайте страницу.
              </p>
            </div>
          )}
          </div>
        </LockedFormOverlay>

        {/* ТОЛЬКО ТЕКСТ результата под столом */}
        {result && !isProcessing && !activeSpread.dialog && (
          <div className="mt-8" ref={resultCardRef}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-[#f3ecff]">
                Толкование расклада
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost"
                    className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white" onClick={copyText}>
                  <Icon name="Copy" size={16} className="mr-1" /> Скопировать
                </Button>
                <Button
                  onClick={downloadPng}
                  className="bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a]"
                >
                  <Icon name="Download" size={16} className="mr-1" /> Скачать PNG
                </Button>
                <Button variant="ghost"
                    className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white" onClick={startNewReadingNow}>
                  <Icon name="RotateCcw" size={16} className="mr-1" /> Очистить
                  форму и начать новый расклад
                </Button>
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-6 shadow-sm ring-1 ring-[#c9a84c]/20">
              <p className="mb-3 text-sm text-[#c9a84c]">{resultDate}</p>

              {resultLayout.length > 0 && (
                <div
                  className="mb-6 overflow-x-auto rounded-2xl border border-[#c9a84c]/25 p-3 sm:p-4"
                  style={{
                    background:
                      "radial-gradient(120% 100% at 50% 0%, #2d1b69 0%, #241845 55%, #1a1030 100%)",
                    boxShadow:
                      "inset 0 0 50px rgba(124,58,237,0.18), inset 0 0 6px rgba(124,58,237,0.12)",
                  }}
                >
                  <div
                    className="grid min-w-[760px] gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${resultCols(resultLayout.length)}, minmax(0, 1fr))` }}
                  >
                    {resultLayout.map((card, idx) =>
                      card ? (
                        <div
                          key={idx}
                          className="rounded-md border border-[#c9a84c]/25 bg-white/[0.06] p-1.5 text-center"
                        >
                          <div className="text-[10px] leading-tight text-[#c9a84c]">
                            {idx + 1}. дом {HOUSE_NAMES[idx]}
                          </div>
                          {getDeckCardImage(card) && (
                            <img
                              src={getDeckCardImage(card)}
                              alt={card}
                              className="mx-auto my-1 h-24 w-[62px] rounded object-contain sm:h-32 sm:w-[82px]"
                              loading="lazy"
                            />
                          )}
                          <div className="text-[11px] font-semibold leading-tight text-[#f3ecff] sm:text-xs">
                            карта {card}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#e8e0f0]">
                {result}
              </div>
            </div>
          </div>
        )}

        {/* Предыдущий расклад из базы (после перезагрузки, пока нет свежего) */}
        {prevResult && !result && !isProcessing && !activeSpread.dialog && (
          <div className="mt-8 rounded-2xl border border-[#c9a84c]/20">
            <button
              type="button"
              onClick={() => setPrevOpen((o) => !o)}
              className="flex w-full items-center justify-between px-5 py-3 text-left"
            >
              <span className="font-medium text-[#f3ecff]">Предыдущий расклад</span>
              <Icon
                name={prevOpen ? "ChevronUp" : "ChevronDown"}
                size={20}
                className="text-[#9888b8]"
              />
            </button>
            {prevOpen && (
              <div className="border-t border-[#c9a84c]/20 p-5">
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-[#c9a84c]/12 p-3 text-sm text-[#e8d9a8] ring-1 ring-[#c9a84c]/30">
                  <Icon name="TriangleAlert" size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Этот расклад удалится, как только вы запустите новый.
                    Рекомендуем скачать картинку или скопировать текст к себе.
                  </span>
                </div>
                <div className="mb-3 flex gap-2">
                  <Button variant="ghost"
                    className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white" size="sm" onClick={copyPrevText}>
                    <Icon name="Copy" size={16} className="mr-1" /> Скопировать
                  </Button>
                  <Button
                    size="sm"
                    onClick={downloadPrevPng}
                    className="bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a]"
                  >
                    <Icon name="Download" size={16} className="mr-1" /> Скачать PNG
                  </Button>
                </div>

                <div
                  className="rounded-2xl border border-[#c9a84c]/20 p-6 shadow-sm"
                  style={{
                    background:
                      "linear-gradient(180deg, #241845 0%, #1a1030 100%)",
                  }}
                >
                  <div className="mb-4 text-center">
                    <h3 className="text-2xl font-semibold text-[#f3ecff]">
                      Большой расклад Ленорман 9 × 4
                    </h3>
                    <p className="mt-1 text-sm text-[#c9a84c]">{prevDate}</p>
                  </div>

                  {prevLayout.length > 0 && (
                    <div
                      className="mb-6 overflow-x-auto rounded-2xl border border-[#c9a84c]/25 p-3 sm:p-4"
                      style={{
                        background:
                          "radial-gradient(120% 100% at 50% 0%, #2d1b69 0%, #241845 55%, #1a1030 100%)",
                        boxShadow:
                          "inset 0 0 50px rgba(124,58,237,0.18), inset 0 0 6px rgba(124,58,237,0.12)",
                      }}
                    >
                      <div
                        className="grid min-w-[760px] gap-1.5"
                        style={{ gridTemplateColumns: `repeat(${resultCols(prevLayout.length)}, minmax(0, 1fr))` }}
                      >
                        {prevLayout.map((card, idx) =>
                          card ? (
                            <div
                              key={idx}
                              className="rounded-md border border-[#c9a84c]/25 bg-white/[0.06] p-1.5 text-center"
                            >
                              <div className="text-[10px] leading-tight text-[#c9a84c]">
                                {idx + 1}. дом {HOUSE_NAMES[idx]}
                              </div>
                              {getDeckCardImage(card) && (
                                <img
                                  src={getDeckCardImage(card)}
                                  alt={card}
                                  className="mx-auto my-1 h-24 w-[62px] rounded object-contain sm:h-32 sm:w-[82px]"
                                  loading="lazy"
                                />
                              )}
                              <div className="text-[11px] font-semibold leading-tight text-[#f3ecff] sm:text-xs">
                                карта {card}
                              </div>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#e8e0f0]">
                    {prevResult}
                  </div>
                  <div className="mt-6 border-t border-[#c9a84c]/25 pt-4 text-center text-xs text-[#9888b8]">
                    <p>
                      Трактовки раскладов носят
                      развлекательно-информационно-рекомендательный характер,
                      создаются нейросетью, мы не несём ответственность за текст
                      ответа нейросети.
                    </p>
                    <p className="mt-1 font-medium text-[#c9a84c]">
                      fitting-room.ru
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Дисклеймер */}
        <div className="mt-10 flex items-start gap-3 rounded-xl border border-[#c9a84c]/35 bg-[#c9a84c]/10 p-4 text-sm text-[#e8d9a8]">
          <Icon name="Info" size={20} className="mt-0.5 shrink-0 text-amber-600" />
          <p>
            Трактовки раскладов носят развлекательно-информационно-рекомендательный
            характер, создаются нейросетью, мы не несём ответственность за текст
            ответа нейросети.
          </p>
        </div>

        <p className="mt-6 text-center text-sm font-medium text-[#c9a84c]">
          fitting-room.ru
        </p>
      </div>
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
              className="mb-6 grid gap-1.5 rounded-2xl border border-purple-200 p-4"
              style={{
                gridTemplateColumns: `repeat(${resultCols(resultLayout.length)}, minmax(0, 1fr))`,
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
                    {getDeckCardImage(card) && (
                      <img
                        src={getDeckCardImage(card)}
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
            {prevLayout.length > 0 && (
              <div
                className="mb-6 grid gap-1.5 rounded-2xl border border-purple-200 p-4"
                style={{
                  gridTemplateColumns: `repeat(${resultCols(prevLayout.length)}, minmax(0, 1fr))`,
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
                      {getDeckCardImage(card) && (
                        <img
                          src={getDeckCardImage(card)}
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

    </Layout>
  );
}
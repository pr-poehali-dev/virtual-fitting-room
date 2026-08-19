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
import { Link, useNavigate } from "react-router-dom";
import { playReadySound } from "@/components/selection/selectionUtils";
import ReadingText from "@/components/divination/ReadingText";
import {
  DISCLAIMER_FULL,
  DISCLAIMER_SHORT,
  QUESTION_HINT,
} from "@/components/divination/texts";
import ReadAloud from "@/components/divination/ReadAloud";
import {
  LENORMAND_AI,
  LENORMAND_SPREAD,
  getDivinationPrice,
  getDivinationMinPrice,
  DIALOG_STEP_PRICES,
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
import SavedDialogs, {
  isMobileDevice,
  type SavedDialog,
} from "@/components/divination/SavedDialogs";
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
  "Ваш пол",
  "Период",
  "Сферы",
  "Что уточнить",
];
// В диалогах период не спрашиваем: горизонт задаёт сам вопрос
const WIZARD_TITLES_DIALOG = WIZARD_TITLES_FULL.slice(0, 5);

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

  // Порог блокировки формы. В диалогах платят за ОДИН шаг, а не за расклад,
  // поэтому денег нужно меньше: в открытом диалоге — цена шага выбранной
  // гадалки, до выбора диалога — цена шага самой недорогой.
  const DIALOG_MIN_STEP = Math.min(...Object.values(DIALOG_STEP_PRICES));

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
  // Вкладка раздела: обычные расклады или диалоги.
  // null — страницу только открыли и категорию ещё не выбирали:
  // тогда ни одна кнопка не подсвечена, чтобы подсветка не врала.
  const [tabChoice, setTabChoice] = useState<DivTab | null>(null);
  const [savedReload, setSavedReload] = useState(0);
  // Сколько ответов уже есть в текущей беседе — от этого зависит подпись кнопки
  const [dialogStepsCount, setDialogStepsCount] = useState(0);
  // Диалог, к которому вернулись из списка сохранённых
  const [resumeDialog, setResumeDialog] = useState<SavedDialog | null>(null);
  // Меняем ключ, чтобы «Начать заново» полностью пересоздавал чат с нуля
  const [dialogKey, setDialogKey] = useState(0);

  // Активный расклад и колода — из реестра (единый источник правды)
  const activeSpread = getSpread(divSpread) ?? getSpread("lenormand_big9x4")!;
  // Пока категорию явно не выбрали, ориентируемся на восстановленный расклад —
  // иначе форма показывала бы шаги не от того типа расклада.
  const tab: DivTab = tabChoice ?? (activeSpread.dialog ? "dialogs" : "spreads");
  // Сколько денег нужно, чтобы форма не была закрыта окном «Пополните баланс»:
  // в открытом диалоге — цена одного шага выбранной гадалки (10 или 25 ₽),
  // на вкладке диалогов до открытия — цена шага самой недорогой (10 ₽),
  // в обычных раскладах — цена самого дешёвого расклада.
  const inOpenDialog = tab === "dialogs" && wizardDone && activeSpread.dialog;
  // В открытом диалоге переписку окном пополнения НЕ закрываем: иначе ответ,
  // за который уже заплатили, окажется размытым. Там блокируем только
  // отправку нового вопроса — это делает сам чат (lowBalance).
  const lockCost = inOpenDialog
    ? 0
    : tab === "dialogs"
      ? DIALOG_MIN_STEP
      : LENORMAND_MIN_COST;

  // Денег не хватает на следующий вопрос выбранной гадалки
  const dialogLowBalance =
    !!user &&
    !hasUnlimited &&
    currentBalance < getDivinationPrice(divSpread, model);

  const activeDeck = getDeck(divSystem as DeckId);
  const spreadSize = activeSpread.size;
  // Карты активной колоды (Ленорман/Таро)
  const deckCards = activeDeck.cards;
  // Набор шагов зависит от типа расклада
  const WIZARD_TITLES = activeSpread.dialog
    ? WIZARD_TITLES_DIALOG
    : WIZARD_TITLES_FULL;
  const WIZARD_STEPS_COUNT = WIZARD_TITLES.length;
  // Шаг «Расклад» показываем, только если есть из чего выбирать:
  // у диалогов на вкладке часто единственный вариант
  const spreadChoiceCount = spreadsByDeck(divSystem as DeckId).filter((sp) =>
    tab === "dialogs" ? sp.dialog : !sp.dialog,
  ).length;
  // Расклады на конкретный вопрос (Кельтский крест, Расклад на план):
  // сферы жизни им не нужны, вместо комментария спрашиваем вопрос
  const asksQuestion = activeSpread.askQuestion === true;
  const isStepVisible = (step: number) => {
    const title = WIZARD_TITLES[step];
    if (title === "Расклад" && spreadChoiceCount <= 1) return false;
    if (title === "Сферы" && asksQuestion) return false;
    return true;
  };
  // Номера показываемых шагов — для счётчика «Шаг X из Y»
  const visibleSteps = Array.from(
    { length: WIZARD_STEPS_COUNT },
    (_, i) => i,
  ).filter(isStepVisible);
  const visibleTotal = visibleSteps.length;
  const visibleNo = Math.max(1, visibleSteps.indexOf(wizardStep) + 1);
  // Переход вперёд/назад с пропуском скрытых шагов
  const stepTo = (from: number, dir: 1 | -1) => {
    let n = from + dir;
    while (n > 0 && n < WIZARD_STEPS_COUNT - 1 && !isStepVisible(n)) n += dir;
    return Math.max(0, Math.min(WIZARD_STEPS_COUNT - 1, n));
  };
  // Картинки карт есть только у колоды Ленорман. Для Таро изображение не
  // подставляем, иначе совпадающие названия (Луна, Башня, Солнце) подтянут
  // чужую картинку из колоды Ленорман.
  // Картинка карты берётся из своей колоды: у Ленорман и Таро есть карты
  // с одинаковыми названиями (Луна, Башня, Солнце) — их нельзя перепутать.
  const cardImageFor = (system: string, name: string) =>
    system === "lenormand"
      ? getCardImageByName(name)
      : getTarotImageByName(name);
  const getDeckCardImage = (name: string) => cardImageFor(divSystem, name);
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
  // Номер расклада в базе — нужен, чтобы отправить его себе на почту
  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  const [prevLayout, setPrevLayout] = useState<string[]>([]);
  const [prevDate, setPrevDate] = useState<string>("");
  // Колода сохранённого расклада: у Ленорман и Таро есть карты с одинаковыми
  // названиями (Солнце, Луна, Башня) — иначе подставится чужая картинка.
  const [prevSystem, setPrevSystem] = useState<string>("lenormand");
  const [resultSystem, setResultSystem] = useState<string>("lenormand");
  const prevCardImage = (name: string) => cardImageFor(prevSystem, name);
  const resultCardImage = (name: string) => cardImageFor(resultSystem, name);
  // Расклад показанного результата: заголовок и названия домов берём из него,
  // а не из текущего выбора в форме
  const [prevSpreadId, setPrevSpreadId] = useState<string>("lenormand_big9x4");
  const [resultSpreadId, setResultSpreadId] = useState<string>("lenormand_big9x4");
  // Старые расклады в базе хранились коротким именем («big9x4»)
  const normSpreadId = (id: string, system: string) =>
    !id ? divSpread : id.includes("_") ? id : `${system}_${id}`;
  const spreadOf = (id: string) => getSpread(id) ?? activeSpread;
  // Названия мест расклада: у Таро это позиции («Суть ситуации»),
  // у Ленорман — дома («Всадник»)
  const houseNamesOf = (system: string, id: string) =>
    getSpread(id)?.positions ?? getDeck(system as DeckId).houseNames ?? [];
  const houseWordOf = (system: string) =>
    system === "tarot" ? "позиция" : "дом";

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const prevCardRef = useRef<HTMLDivElement>(null);
  const dbPrevCardRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const FORM_STORAGE_KEY = "lenormand_form_v2";
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
        setPrevTaskId(data.id || null);
        setPrevLayout(layoutArr);
        // Колода расклада — из его же данных, а не из текущего выбора
        setPrevSystem(meta.system === "tarot" ? "tarot" : "lenormand");
        setPrevSpreadId(
          normSpreadId(meta.spread || "", meta.system === "tarot" ? "tarot" : "lenormand"),
        );
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
    setDivSpread("lenormand_big9x4");
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

  // «Начать заново» в диалогах: возвращаемся к состоянию сразу после выбора
  // категории «Диалоги». Беседа с ответами остаётся на сервере и появляется
  // в списке «Сохранено у вас» — её можно продолжить позже.
  const startNewDialog = () => {
    const firstDialog = spreadsByDeck("lenormand").find((sp) => sp.dialog);
    setGender("female");
    setPeriod("now");
    setSpheres(["all"]);
    setComment("");
    setModel(MODELS[0].value);
    setMode("online");
    setDivSystem("lenormand");
    if (firstDialog) {
      setDivSpread(firstDialog.id);
      setLayout(EMPTY_LAYOUT(firstDialog.size));
    }
    setResumeDialog(null);
    setWizardStep(0);
    setWizardDone(false);
    setDialogKey((k) => k + 1);
    setSavedReload((k) => k + 1);
    try {
      localStorage.removeItem(FORM_STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    toast.success("Можно начать новый диалог");
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

  // Отправка расклада себе на почту — вместо «Поделиться» на компьютере,
  // где системного меню отправки нет
  const [sendingMail, setSendingMail] = useState(false);

  const emailShownReading = async () => {
    if (!prevTaskId) {
      toast.error("Расклад ещё сохраняется, попробуйте через пару секунд");
      return;
    }
    setSendingMail(true);
    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch(LENORMAND_LAST, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Session-Token": token } : {}),
        },
        body: JSON.stringify({ action: "email", id: prevTaskId }),
      });
      const data = await res.json();
      if (!res.ok || !data.sent) {
        toast.error(data.error || "Не удалось отправить письмо");
        return;
      }
      toast.success(`Расклад отправлен на ${data.email}`);
    } catch {
      toast.error("Ошибка соединения");
    } finally {
      setSendingMail(false);
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
      // Шага «Сферы» не было — не отправляем то, чего не выбирали
      spheres: asksQuestion ? [] : spheres,
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
      // Номер задачи пригодится для отправки расклада на почту
      setPrevTaskId(data.task_id || null);
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
        // Токен обязателен: результат отдаётся только тому, кто его заказал
        const statusToken = localStorage.getItem("session_token");
        const res = await fetch(`${AI_EDITOR_STATUS}?task_id=${taskId}`, {
          headers: statusToken ? { "X-Session-Token": statusToken } : {},
        });
        const data = await res.json();
        // Толкование пишется на глазах — показываем, что работа идёт
        if (data.written_chars > 0 && data.status !== "completed") {
          setStatusText(
            `Толкование пишется... ${Math.round(data.written_chars / 1000)} тыс. знаков · ${elapsed} сек`,
          );
        }
        if (data.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setIsProcessing(false);
          setStatusText("");
          // Появился свежий результат — прячем «предыдущий из базы»
          setPrevResult(null);
          setResult(data.ai_response || "");
          setResultLayout(submittedLayout);
          setResultSystem(divSystem);
          setResultSpreadId(divSpread);
          setResultDate(
            new Date().toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          );
          setDownloaded(false);
          // Стол освобождаем: расклад уже сохранён и показан ниже,
          // а карты прошлого расклада мешают начать новый
          resetTable();
          // Вопрос относился к этому раскладу — в новом он будет свой
          setComment("");
          // Черновик формы больше не нужен: он бережёт заполнение
          // от случайной перезагрузки, но расклад уже отправлен —
          // иначе после перезагрузки вернутся старые карты и вопрос
          try {
            localStorage.removeItem(FORM_STORAGE_KEY);
          } catch (e) {
            /* ignore */
          }
          refreshBalance();
          // Расклад считается долго — зовём звуком, если вкладка свёрнута
          playReadySound();
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

  // Отправка расклада картинкой в мессенджер: на телефоне открывается
  // системное «Поделиться», на компьютере — просто сохраняем картинку.
  const shareReading = async (
    node: HTMLDivElement | null,
    markDownloaded = false,
  ) => {
    if (!node) return;
    try {
      await inlineCardImages(node);
      await waitForImages(node);
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(node, {
        backgroundColor: "#faf7ff",
        scale: 2,
        useCORS: true,
        imageTimeout: 15000,
      });
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("no blob");

      const file = new File([blob], `raskad-${Date.now()}.png`, {
        type: "image/png",
      });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };

      if (isMobileDevice() && nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Мой расклад",
          text: "Толкование расклада",
        });
        if (markDownloaded) setDownloaded(true);
        return;
      }

      // Без системного «Поделиться» просто сохраняем — результат не теряется
      const link = document.createElement("a");
      link.download = file.name;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      if (markDownloaded) setDownloaded(true);
      toast.success("Картинка сохранена — можно отправить из «Загрузок»");
    } catch (e) {
      // Пользователь мог сам закрыть окно «Поделиться» — это не ошибка
      if ((e as Error)?.name === "AbortError") return;
      toast.error("Не удалось поделиться раскладом");
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
    setWizardStep((prev) => {
      const last = WIZARD_STEPS_COUNT - 1;
      const cur = prev > last ? last : prev;
      // Не оставляем пользователя на скрытом шаге
      return isStepVisible(cur) ? cur : stepTo(cur, 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // divSpread в списке: у таких раскладов шаг «Сферы» пропадает,
    // и на нём нельзя остаться
  }, [WIZARD_STEPS_COUNT, spreadChoiceCount, tab, divSystem, divSpread]);

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

  // Сколько колонок рисовать для готового расклада.
  // Берём форму из самого расклада, а не из числа карт: 36 карт бывают
  // и 9x4, и 8x4+4 — иначе второй рисовался как первый.
  const resultCols = (len: number, spreadId?: string) => {
    // Кельтский крест — фигура, а не ряды: 5 колонок под крест и столбец
    if (spreadId && getSpread(spreadId)?.shape === "celtic") return 5;
    const g = spreadId ? getSpread(spreadId)?.grid : null;
    if (g?.cols) return g.cols;
    if (len >= 36) return 9;
    if (len >= 10) return 5;
    if (len >= 3) return len;
    return 1;
  };

  // Итоговые карты (8x4+4) лежат отдельной строкой по центру под полем.
  // Первой из них задаём отступ, чтобы строка встала по середине.
  // Места карт Кельтского креста в сетке 5×4 (как на столе выкладки)
  const CELTIC_PLACE: { col: number; row: number }[] = [
    { col: 2, row: 2 }, // 1 — центр
    { col: 3, row: 2 }, // 2 — поперёк первой
    { col: 2, row: 1 }, // 3 — над центром
    { col: 2, row: 3 }, // 4 — под центром
    { col: 1, row: 2 }, // 5 — слева
    { col: 4, row: 2 }, // 6 — справа
    { col: 5, row: 4 }, // 7 — низ столбца
    { col: 5, row: 3 }, // 8
    { col: 5, row: 2 }, // 9
    { col: 5, row: 1 }, // 10 — верх столбца
  ];

  // Вторая карта Кельтского креста лежит поперёк первой
  const isCrossed = (idx: number, spreadId?: string) =>
    idx === 1 && !!spreadId && getSpread(spreadId)?.shape === "celtic";

  const cellStyle = (idx: number, spreadId?: string) => {
    if (spreadId && getSpread(spreadId)?.shape === "celtic") {
      const p = CELTIC_PLACE[idx];
      return p ? { gridColumn: p.col, gridRow: p.row } : undefined;
    }
    const g = spreadId ? getSpread(spreadId)?.grid : null;
    if (!g?.tail || !g.cols || !g.rows) return undefined;
    const start = g.cols * g.rows;
    if (idx !== start) return undefined;
    const offset = Math.max(1, Math.floor((g.cols - g.tail) / 2) + 1);
    return { gridColumnStart: offset };
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
    // Такие расклады делают на конкретную ситуацию — без вопроса
    // толкование получится размытым
    if (title === "Что уточнить" && asksQuestion && !comment.trim())
      return "Напишите вопрос";
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
      <div className="mx-auto max-w-6xl px-1 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${divTheme.accentSoft}`}>
            <Icon name="Sparkles" size={28} className="text-[#c9a84c]" />
          </div>
          <h1 className={`text-3xl sm:text-4xl ${divTheme.title}`}>
            Гадания на картах онлайн с ИИ
          </h1>
          <p className={`mt-2 ${divTheme.muted}`}>
            Выберите расклад и гадалку — и получите подробное личное толкование
          </p>
        </div>

        {/* Две категории: расклады и диалоги — со своими правилами хранения */}
        <DivinationTabs
          value={tabChoice}
          onChange={(next) => {
            setTabChoice(next);
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

        {tabChoice === "dialogs" && (
          <SavedDialogs
            reloadKey={savedReload}
            onContinue={(d) => {
              setTabChoice("dialogs");
              setDivSystem(d.system as DeckId);
              setDivSpread(d.spread);
              setResumeDialog(d);
              setWizardDone(true);
            }}
          />
        )}

        {/* Пока категория не выбрана — форму не показываем: неизвестно,
            расклад это или диалог, а наборы шагов у них разные */}
        {!tabChoice && (
          <div className="mb-8 rounded-2xl border border-dashed border-[#c9a84c]/30 bg-white/[0.03] px-4 py-10 text-center sm:px-6">
            <Icon
              name="Hand"
              size={32}
              className="mx-auto mb-3 text-[#c9a84c]"
            />
            <p className="text-base font-medium text-[#f3ecff]">
              Выберите, что хотите сделать
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#9888b8]">
              «Расклады» — одно подробное толкование. «Диалоги» — разговор с
              картами: вопрос, ответ и уточнения.
            </p>
          </div>
        )}

        {/* Предыдущий расклад — над формой: иначе он теряется внизу,
            а окно «У вас есть готовый расклад» закрывает форму */}
        {prevResult && !result && !isProcessing && !activeSpread.dialog && (
          <div className="mb-8 rounded-2xl border border-[#c9a84c]/20">
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
              <div className="border-t border-[#c9a84c]/20 p-1 sm:p-5">
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-[#c9a84c]/12 p-3 text-sm text-[#e8d9a8] ring-1 ring-[#c9a84c]/30">
                  <Icon name="Bookmark" size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Здесь показан последний расклад. Все ваши расклады
                    сохраняются в личном кабинете —{" "}
                    <Link
                      to="/profile/history-divination"
                      className="font-semibold text-[#c9a84c] underline underline-offset-2"
                    >
                      Мои гадания
                    </Link>
                    .
                  </span>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <ReadAloud text={prevResult} compact />
                  {isMobileDevice() && (
                    <Button
                      size="sm"
                      onClick={() => shareReading(dbPrevCardRef.current)}
                      className="bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a]"
                    >
                      <Icon name="Share2" size={16} className="mr-1" /> Поделиться
                    </Button>
                  )}
                  {/* На компьютере системного «Поделиться» нет — шлём письмо себе */}
                  {!isMobileDevice() && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={sendingMail}
                      onClick={emailShownReading}
                      className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                    >
                      <Icon
                        name={sendingMail ? "Loader2" : "Mail"}
                        size={16}
                        className={`mr-1 ${sendingMail ? "animate-spin" : ""}`}
                      />
                      Отправить на почту
                    </Button>
                  )}
                  <Button variant="ghost"
                    className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white" size="sm" onClick={copyPrevText}>
                    <Icon name="Copy" size={16} className="mr-1" /> Скопировать
                  </Button>
                  <Button
                    size="sm"
                    variant={isMobileDevice() ? "ghost" : "default"}
                    onClick={downloadPrevPng}
                    className={
                      isMobileDevice()
                        ? "bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                        : "bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a]"
                    }
                  >
                    <Icon name="Download" size={16} className="mr-1" /> Скачать PNG
                  </Button>
                </div>

                <div
                  className="rounded-2xl border border-[#c9a84c]/20 p-1.5 shadow-sm sm:p-6"
                  style={{
                    background:
                      "linear-gradient(180deg, #241845 0%, #1a1030 100%)",
                  }}
                >
                  <div className="mb-4 text-center">
                    <h3 className="text-2xl font-semibold text-[#f3ecff]">
                      {spreadOf(prevSpreadId).title}
                    </h3>
                    <p className="mt-1 text-sm text-[#c9a84c]">{prevDate}</p>
                  </div>

                  {prevLayout.length > 0 && (
                    <div
                      className="mb-4 overflow-x-auto rounded-2xl border border-[#c9a84c]/25 p-1.5 sm:mb-6 sm:p-4"
                      style={{
                        background:
                          "radial-gradient(120% 100% at 50% 0%, #2d1b69 0%, #241845 55%, #1a1030 100%)",
                        boxShadow:
                          "inset 0 0 50px rgba(124,58,237,0.18), inset 0 0 6px rgba(124,58,237,0.12)",
                      }}
                    >
                      <div
                        className="grid min-w-[760px] gap-1.5 [grid-auto-rows:1fr]"
                        style={{ gridTemplateColumns: `repeat(${resultCols(prevLayout.length, prevSpreadId)}, minmax(0, 1fr))` }}
                      >
                        {prevLayout.map((card, idx) =>
                          card ? (
                            <div
                              key={idx}
                              style={cellStyle(idx, prevSpreadId)}
                              className="rounded-md border border-[#c9a84c]/25 bg-white/[0.06] p-1.5 text-center"
                            >
                              <div className="text-[10px] leading-tight text-[#c9a84c]">
                                {idx + 1}. {houseWordOf(prevSystem)} {houseNamesOf(prevSystem, prevSpreadId)[idx]}
                              </div>
                              {prevCardImage(card) && (
                                <img
                                  src={prevCardImage(card)}
                                  alt={card}
                                  className={`mx-auto my-1 h-24 w-[62px] rounded object-contain sm:h-32 sm:w-[82px] ${
                                    isCrossed(idx, prevSpreadId) ? "rotate-90" : ""
                                  }`}
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

                  {/* Дубль кнопки у самого текста — не надо прокручивать вверх */}
                  <div className="mb-3">
                    <ReadAloud text={prevResult} compact />
                  </div>

                  <ReadingText text={prevResult} />
                  <div className="mt-6 border-t border-[#c9a84c]/25 pt-4 text-center text-xs text-[#9888b8]">
                    <p>
                      {DISCLAIMER_SHORT}
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

        {tabChoice && (
        <LockedFormOverlay cost={lockCost}>
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
                  Он сохранён в личном кабинете, в разделе «Мои гадания».
                  Здесь его заменит новый расклад.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      setTouchAck(true);
                      dropPrevResult();
                    }}
                    className="bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a]"
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
                      <span className="font-semibold text-[#e8c252]">
                        {activeSpread.dialog ? "Новый диалог" : "Новый расклад"}
                      </span>
                      {" · "}Шаг {visibleNo} из {visibleTotal}
                    </span>
                    <span className="text-xs text-white/70">
                      {visibleNo}/{visibleTotal}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#c9a84c] to-[#e8c252] transition-all"
                      style={{
                        width: `${(visibleNo / visibleTotal) * 100}%`,
                      }}
                    />
                  </div>
                  {/* Навигация в шапке: на широком экране слева и справа
                      от заголовка, на телефоне — строкой над ним */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <button
                      type="button"
                      onClick={() => setWizardStep((s) => stepTo(s, -1))}
                      disabled={wizardStep === 0 || formDisabled}
                      className="inline-flex shrink-0 items-center rounded-xl border-2 border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-white disabled:opacity-40"
                    >
                      <Icon name="ArrowLeft" size={16} className="mr-1.5" />
                      Назад
                    </button>

                    <h2 className="order-last w-full text-center font-serif text-2xl text-[#f3ecff] sm:order-none sm:w-auto sm:flex-1">
                      {WIZARD_TITLES[wizardStep] === "Что уточнить" &&
                      asksQuestion
                        ? "Ваш вопрос"
                        : WIZARD_TITLES[wizardStep]}
                    </h2>

                    {wizardStep === WIZARD_STEPS_COUNT - 1 ? (
                      <button
                        type="button"
                        onClick={() => setWizardDone(true)}
                        disabled={formDisabled || !!stepBlockReason}
                        title={stepBlockReason || undefined}
                        className="inline-flex shrink-0 items-center rounded-xl bg-gradient-to-r from-[#c9a84c] to-[#e8c252] px-6 py-2.5 text-sm font-semibold text-[#1a1030] shadow-lg transition hover:from-[#d8b75b] hover:to-[#f0cf6a] disabled:opacity-40"
                      >
                        <Icon name="Check" size={16} className="mr-1.5" />
                        Готово
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setWizardStep((s) => stepTo(s, 1))}
                        disabled={formDisabled || !!stepBlockReason}
                        title={stepBlockReason || undefined}
                        className="inline-flex shrink-0 items-center rounded-xl bg-gradient-to-r from-[#c9a84c] to-[#e8c252] px-6 py-2.5 text-sm font-semibold text-[#1a1030] shadow-lg transition hover:from-[#d8b75b] hover:to-[#f0cf6a] disabled:opacity-40"
                      >
                        Далее
                        <Icon name="ArrowRight" size={16} className="ml-1.5" />
                      </button>
                    )}
                  </div>

                  {/* Почему шаг нельзя пройти дальше */}
                  {stepBlockReason && (
                    <p className="mt-2 text-center text-sm text-[#e8d9a8]">
                      {stepBlockReason}
                    </p>
                  )}
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
                                ? "border-[#c9a84c] bg-[#c9a84c]/15"
                                : "border-white/20 hover:border-[#c9a84c]/60"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon
                                name={active ? "CircleDot" : "Circle"}
                                size={16}
                                className={`shrink-0 ${active ? "text-[#c9a84c]" : "text-white/70"}`}
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
                        // Подсказка, в каких случаях расклад уместен
                        hint: sp.whenToUse,
                        icon: sp.icon,
                        badge: sp.dialog ? "Диалог" : undefined,
                        note: sp.dialog
                          ? `${getDivinationPrice(sp.id, model)} \u20bd/вопрос`
                          : `${getDivinationPrice(sp.id, model)} \u20bd`,
                        }))}
                    />
                  )}

                  {/* Шаг 2: Нейросеть-гадалка */}
                  {wizardStep === 2 && (
                    <div>
                      <div
                        role="radiogroup"
                        className="grid gap-2.5 sm:grid-cols-2"
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
                                  ? "border-[#c9a84c] bg-[#c9a84c]/15"
                                  : "border-white/20 hover:border-[#c9a84c]/60"
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-white">
                                  {m.label}
                                </span>
                                <Icon
                                  name={selected ? "CircleDot" : "Circle"}
                                  size={18}
                                  className={`shrink-0 ${selected ? "text-[#c9a84c]" : "text-white/70"}`}
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
                                ? "border-[#c9a84c] bg-[#c9a84c]/15 text-white"
                                : "border-white/20 text-white/80 hover:border-[#c9a84c]/60 hover:text-white"
                            }`}
                          >
                            <Icon
                              name={active ? "CircleDot" : "Circle"}
                              size={16}
                              className={active ? "text-[#c9a84c]" : "text-white/70"}
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
                                ? "border-[#c9a84c] bg-[#c9a84c]/15 text-white"
                                : "border-white/20 text-white/80 hover:border-[#c9a84c]/60 hover:text-white"
                            }`}
                          >
                            <Icon
                              name={active ? "CircleDot" : "Circle"}
                              size={16}
                              className={active ? "text-[#c9a84c]" : "text-white/70"}
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
                              ? "border-[#c9a84c] bg-[#c9a84c]/15 text-white"
                              : "border-white/20 text-white/80 hover:border-[#c9a84c]/60 hover:text-white"
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

                  {/* Шаг 7: Комментарий, у Кельтского креста — вопрос */}
                  {wizardStep === 7 && (
                    <div className="w-full">
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={
                          asksQuestion
                            ? "Например: как сложится новый проект?"
                            : "Например: каким будет мой новый образ этой весной?"
                        }
                        rows={3}
                        className="border-2 border-white/50 bg-transparent text-white placeholder:text-white/60 focus-visible:ring-white/40"
                      />
                      {/* Примеры вопросов именно этого расклада */}
                      {activeSpread.typicalQuestions?.length ? (
                        <div className="mt-3 rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#c9a84c]">
                            С такими вопросами расклад работает лучше всего
                          </p>
                          <ul className="mt-1.5 space-y-1">
                            {activeSpread.typicalQuestions.map((q) => (
                              <li
                                key={q}
                                className="text-sm leading-snug text-white/80"
                              >
                                — {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {/* Подсказываем, какие вопросы карты раскрывают лучше */}
                      <p className="mt-3 text-sm leading-relaxed text-white/70">
                        {QUESTION_HINT}
                      </p>
                    </div>
                  )}
                  </div>
                </fieldset>
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
              spheresLabel={SPHERES.filter((sp) => spheres.includes(sp.key))
                .map((sp) => sp.label)
                .join(", ")}
              comment={comment}
              hideTopic
              hideEdit
              isDialog
              clearLabel={
                dialogStepsCount > 0
                  ? "Начать новый диалог"
                  : "Очистить всё и начать заново"
              }
              disabled={false}
              onEdit={() => {
                setWizardDone(false);
                setWizardStep(0);
              }}
              onClearAll={startNewDialog}
            />
          )}

          {wizardDone && activeSpread.dialog && (
            <DialogChat
              key={`${divSpread}-${model}-${dialogKey}`}
              spread={activeSpread}
              deckCards={deckCards}
              backImage={deckBackImage}
              model={model}
              context={{ gender, spheres, comment: comment.trim() }}
              cardsPerStep={6}
              mode={mode}
              deckMode="full"
              resumeDialog={resumeDialog}
              onDialogChanged={() => setSavedReload((k) => k + 1)}
              onStepsChange={setDialogStepsCount}
              stepPrice={selectedCost}
              maxSteps={DIALOG_MAX_STEPS}
              getCardImage={getDeckCardImage}
              onBalanceChange={refreshBalance}
              onNeedTopup={() => navigate("/profile/wallet")}
              lowBalance={dialogLowBalance}
            />
          )}

          {wizardDone && !activeSpread.dialog && (
          <>
          <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-[#2d1b69] via-[#241845] to-[#1a1030] text-white shadow-lg ring-1 ring-[#c9a84c]/25">
            <CardContent className="p-6">
              {/* Кнопки: на широком экране справа от заголовка,
                  на телефоне — над ним, по левому краю */}
              <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-serif text-2xl text-[#f3ecff]">
                  Параметры расклада
                </h2>
                <div className="flex flex-wrap justify-end gap-2">
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
              </div>
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
                {!activeSpread.dialog && (
                  <>
                    <span className="text-white/40">·</span>
                    <span>
                      <span className="text-white/60">Период:</span>{" "}
                      {PERIODS.find((p) => p.key === period)?.label}
                    </span>
                  </>
                )}
                {/* Сфер не было — в сводке их тоже не показываем */}
                {!asksQuestion && (
                  <>
                    <span className="text-white/40">·</span>
                    <span>
                      <span className="text-white/60">Сферы:</span>{" "}
                      {SPHERES.filter((s) => spheres.includes(s.key))
                        .map((s) => s.label)
                        .join(", ")}
                    </span>
                  </>
                )}
                <span className="text-white/40">·</span>
                <span>
                  <span className="text-white/60">
                    {asksQuestion ? "Вопрос:" : "Комментарий:"}
                  </span>{" "}
                  {comment.trim() || "—"}
                </span>
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
                      size="lg"
                      onClick={shuffleDeck}
                      disabled={formDisabled}
                      className={`${divTheme.btnHero} w-full sm:w-auto`}
                    >
                      <Icon name="Shuffle" size={20} className="mr-2" />
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
                    ? `Активное место: ${activeHouse + 1}. ${houseNamesOf(divSystem, divSpread)[activeHouse]}. Кликните карту-рубашку в колоде под столом.`
                    : "Перемешайте карты, чтобы начать. Колода появится под столом."
                  : "Выберите дом, затем кликните карту, которая выпала в реальном раскладе. Список карт — под столом."}
              </p>

              {/* Стол расклада — геометрия берётся из реестра раскладов */}
              <SpreadTable
                spread={activeSpread}
                houseNames={houseNamesOf(divSystem, divSpread)}
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
                  size="lg"
                  onClick={startReading}
                  disabled={isProcessing || !tableReady}
                  title={tableReady ? undefined : tableHint}
                  className={`${divTheme.btnHero} w-full disabled:opacity-50 sm:w-auto`}
                >
                  {isProcessing ? (
                    <>
                      <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                      {statusText || "Обработка…"}
                    </>
                  ) : (
                    <>
                      <Icon name="Sparkles" size={20} className="mr-2" />
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
              className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-[#c9a84c]/20 bg-white/[0.04] px-4 py-12 text-center sm:px-6"
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
                Большой расклад обычно готовится 3–5 минут. Можно свернуть
                вкладку — расчёт не прервётся, результат сохранится.
              </p>
            </div>
          )}
          </div>
        </LockedFormOverlay>
        )}

        {/* ТОЛЬКО ТЕКСТ результата под столом */}
        {result && !isProcessing && !activeSpread.dialog && (
          <div className="mt-8" ref={resultCardRef}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-[#f3ecff]">
                Толкование{" "}
                <span className="text-[#e8c252]">
                  {spreadOf(resultSpreadId).title}
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {/* Толкования длинные — даём возможность слушать, а не читать */}
                <ReadAloud text={result} />
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
                {/* На компьютере системного «Поделиться» нет — шлём письмо себе */}
                {!isMobileDevice() && (
                  <Button
                    variant="ghost"
                    disabled={sendingMail}
                    onClick={emailShownReading}
                    className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
                  >
                    <Icon
                      name={sendingMail ? "Loader2" : "Mail"}
                      size={16}
                      className={`mr-1 ${sendingMail ? "animate-spin" : ""}`}
                    />
                    Отправить на почту
                  </Button>
                )}
                <Button variant="ghost"
                    className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white" onClick={startNewReadingNow}>
                  <Icon name="RotateCcw" size={16} className="mr-1" /> Очистить
                  форму и начать новый расклад
                </Button>
              </div>
            </div>
            {/* Расклад хранится только один — предупреждаем заранее и даём
                отправить его себе, пока он не заменён следующим */}
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#c9a84c]/40 bg-[#c9a84c]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <Icon
                  name="TriangleAlert"
                  size={20}
                  className="mt-0.5 shrink-0 text-[#c9a84c]"
                />
                <p className="text-sm text-[#e8d9a8]">
                  Расклад сохранён в личном кабинете — раздел «Мои гадания».
                  {isMobileDevice()
                    ? " А ещё им можно поделиться или скачать картинкой."
                    : " А ещё его можно сохранить картинкой."}
                </p>
              </div>
              <Button
                onClick={() => shareReading(prevCardRef.current, true)}
                className="shrink-0 bg-gradient-to-r from-[#c9a84c] to-[#e8c252] font-semibold text-[#1a1030] hover:from-[#d8b75b] hover:to-[#f0cf6a]"
              >
                <Icon
                  name={isMobileDevice() ? "Share2" : "Download"}
                  size={16}
                  className="mr-1.5"
                />
                {isMobileDevice() ? "Поделиться раскладом" : "Сохранить картинку"}
              </Button>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-0 shadow-sm ring-1 ring-[#c9a84c]/20 sm:p-6">
              <p className="mb-2 px-2 pt-2 text-sm text-[#c9a84c] sm:px-0 sm:pt-0">{resultDate}</p>

              {resultLayout.length > 0 && (
                <div
                  className="mb-4 overflow-x-auto rounded-2xl border border-[#c9a84c]/25 p-1.5 sm:mb-6 sm:p-4"
                  style={{
                    background:
                      "radial-gradient(120% 100% at 50% 0%, #2d1b69 0%, #241845 55%, #1a1030 100%)",
                    boxShadow:
                      "inset 0 0 50px rgba(124,58,237,0.18), inset 0 0 6px rgba(124,58,237,0.12)",
                  }}
                >
                  <div
                    className="grid min-w-[760px] gap-1.5 [grid-auto-rows:1fr]"
                    style={{ gridTemplateColumns: `repeat(${resultCols(resultLayout.length, resultSpreadId)}, minmax(0, 1fr))` }}
                  >
                    {resultLayout.map((card, idx) =>
                      card ? (
                        <div
                          key={idx}
                          style={cellStyle(idx, resultSpreadId)}
                          className="rounded-md border border-[#c9a84c]/25 bg-white/[0.06] p-1.5 text-center"
                        >
                          <div className="text-[10px] leading-tight text-[#c9a84c]">
                            {idx + 1}. {houseWordOf(resultSystem)} {houseNamesOf(resultSystem, resultSpreadId)[idx]}
                          </div>
                          {resultCardImage(card) && (
                            <img
                              src={resultCardImage(card)}
                              alt={card}
                              className={`mx-auto my-1 h-24 w-[62px] rounded object-contain sm:h-32 sm:w-[82px] ${
                                isCrossed(idx, resultSpreadId) ? "rotate-90" : ""
                              }`}
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

              {/* Кнопка прямо над толкованием: текст длинный, и искать
                  «Слушать» в шапке приходится прокруткой вверх */}
              <div className="mb-3">
                <ReadAloud text={result} compact />
              </div>

              {/* Длинный текст читают подолгу: тёплый пергамент,
                  тёмные крупные буквы и настоящие заголовки разделов */}
              <ReadingText text={result} />
            </div>
          </div>
        )}


        {/* Дисклеймер */}
        <div className="mt-10 flex items-start gap-3 rounded-xl border border-[#c9a84c]/35 bg-[#c9a84c]/10 p-4 text-sm text-[#e8d9a8]">
          <Icon name="Info" size={20} className="mt-0.5 shrink-0 text-amber-600" />
          <p>{DISCLAIMER_FULL}</p>
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
                {spreadOf(resultSpreadId).title}
              </h3>
              <p className="mt-1 text-sm text-purple-500">{resultDate}</p>
            </div>
            <div
              className="mb-6 grid gap-1.5 rounded-2xl border border-purple-200 p-4 [grid-auto-rows:1fr]"
              style={{
                gridTemplateColumns: `repeat(${resultCols(resultLayout.length, resultSpreadId)}, minmax(0, 1fr))`,
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
                    style={cellStyle(idx, resultSpreadId)}
                    className="rounded-md border border-purple-200 bg-white/60 p-1.5 text-center"
                  >
                    <div className="text-xs text-purple-700">
                      {idx + 1}. {houseWordOf(resultSystem)} {houseNamesOf(resultSystem, resultSpreadId)[idx]}
                    </div>
                    {resultCardImage(card) && (
                      <img
                        src={resultCardImage(card)}
                        alt={card}
                        data-card-img="1"
                        className={`mx-auto my-1 h-32 w-[82px] rounded object-contain ${
                          isCrossed(idx, resultSpreadId) ? "rotate-90" : ""
                        }`}
                      />
                    )}
                    <div className="text-sm font-semibold text-purple-900">
                      карта {card}
                    </div>
                  </div>
                ) : null
              )}
            </div>
            <ReadingText text={result} bare />
            <div className="mt-6 border-t border-purple-200 pt-4 text-center text-xs text-purple-400">
              <p>
                {DISCLAIMER_SHORT}
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
                {spreadOf(prevSpreadId).title}
              </h3>
              <p className="mt-1 text-sm text-purple-500">{prevDate}</p>
            </div>
            {prevLayout.length > 0 && (
              <div
                className="mb-6 grid gap-1.5 rounded-2xl border border-purple-200 p-4 [grid-auto-rows:1fr]"
                style={{
                  gridTemplateColumns: `repeat(${resultCols(prevLayout.length, prevSpreadId)}, minmax(0, 1fr))`,
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
                      style={cellStyle(idx, prevSpreadId)}
                      className="rounded-md border border-purple-200 bg-white/60 p-1.5 text-center"
                    >
                      <div className="text-xs text-purple-700">
                        {idx + 1}. {houseWordOf(prevSystem)} {houseNamesOf(prevSystem, prevSpreadId)[idx]}
                      </div>
                      {prevCardImage(card) && (
                        <img
                          src={prevCardImage(card)}
                          alt={card}
                          data-card-img="1"
                          className={`mx-auto my-1 h-32 w-[82px] rounded object-contain ${
                            isCrossed(idx, prevSpreadId) ? "rotate-90" : ""
                          }`}
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
            <ReadingText text={prevResult} bare />
            <div className="mt-6 border-t border-purple-200 pt-4 text-center text-xs text-purple-400">
              <p>
                {DISCLAIMER_SHORT}
              </p>
              <p className="mt-1 font-medium text-purple-500">fitting-room.ru</p>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
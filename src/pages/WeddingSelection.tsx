import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { validateImageFile } from "@/utils/fileValidation";
import LockedFormOverlay from "@/components/LockedFormOverlay";
import { useAuth } from "@/context/AuthContext";
import { WEDDING_SELECTION_COST } from "@/config/prices";
import { useBalance } from "@/context/BalanceContext";
import { useNavigate } from "react-router-dom";
import WeddingReport, {
  WeddingResult,
  WeddingFormParams,
} from "@/components/WeddingReport";
import FaqAccordion from "@/components/FaqAccordion";
import { useScrollToResult } from "@/hooks/useScrollToResult";
import TagPicker from "@/components/selection/TagPicker";
import {
  ARCHETYPES,
  COLORTYPES,
  MAX_ARCHETYPES,
  MAX_COLORTYPES,
  mergeCustom,
  playReadySound,
} from "@/components/selection/selectionUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  OutfitProfile,
  fetchOutfitProfiles,
  saveOutfitProfile,
} from "@/lib/outfitProfiles";
import {
  SourceLook,
  fetchSourceLooks,
  fetchLookDetail,
  buildStyleFromLook,
  buildPartnerLookText,
} from "@/lib/weddingSourceLooks";

const START_API =
  "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
const STATUS_API =
  "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";

const COST = WEDDING_SELECTION_COST;
const POLLING_INTERVAL = 8000;
const TIMEOUT_DURATION = 300000;

const ROLES = ["Невеста", "Жених"];

const STYLE_MODES = [
  "Стиль свадьбы уже выбран",
  "Подобрать стиль от образа (от обратного)",
  "Взять стиль из моего готового образа",
];

const KIBBE_TYPES = [
  "Dramatic (Драматик)",
  "Soft Dramatic (Мягкий драматик)",
  "Flamboyant Natural (Яркий натурал)",
  "Soft Natural (Мягкий натурал)",
  "Dramatic Classic (Драматик классик)",
  "Soft Classic (Мягкий классик)",
  "Flamboyant Gamine (Яркий гамин)",
  "Soft Gamine (Мягкий гамин)",
  "Theatrical Romantic (Театральный романтик)",
  "Romantic (Романтик)",
];

const WEDDING_SEASONS = ["Весна", "Лето", "Осень", "Зима"];

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const VENUES = [
  "Выездная церемония на природе",
  "Банкетный зал / ресторан",
  "Загородная усадьба",
  "Пляж / у воды",
  "Лофт",
  "Сад / оранжерея",
  "Шатёр на улице",
  "Венчание в церкви",
  "Только ЗАГС",
  "Свадьба за границей",
];

const DAY_TIMES = ["Утро", "День", "Закат", "Вечер"];

const WEDDING_STYLES = [
  "Классическая свадьба",
  "Выездная церемония",
  "Богемная (boho)",
  "Рустик",
  "Камерная свадьба на своих",
  "Гламурная / luxury",
  "Минимализм",
  "Винтаж / ретро",
  "Тематическая",
  "Свадьба в стиле Прованс",
  "Свадьба на природе / эко",
  "Дестинейшн у моря",
];

const TAGS = [
  "Нежно и романтично",
  "Элегантно и сдержанно",
  "Вау-эффект",
  "Минимализм",
  "Роскошно",
  "Естественно и легко",
  "Современно",
  "Классика на все времена",
  "Уютно и по-домашнему",
  "Максимально комфортно",
];

const FABRICS = [
  "Шёлк",
  "Атлас",
  "Креп",
  "Кружево",
  "Фатин",
  "Шифон",
  "Органза",
  "Бархат",
  "Лён",
  "Шерсть",
  "Хлопок",
  "Микадо",
];

const COLORS = [
  "Чистый белый",
  "Айвори",
  "Шампань",
  "Молочный",
  "Пудровый",
  "Слоновая кость",
  "Серебристый",
  "Золотой",
  "Пыльно-розовый",
  "Голубой",
  "Изумрудный",
  "Тёмно-синий",
  "Серый",
  "Бежевый",
  "Чёрный",
  "Бордовый",
];

const DRESS_SILHOUETTES = [
  "Не знаю, подберите",
  "А-силуэт",
  "Русалка",
  "Прямое / колонна",
  "Пышное",
  "Ампир",
  "Короткое",
  "Костюм или комбинезон",
];

const HAIR_LENGTHS = ["Короткие", "До плеч", "Средние", "Длинные"];

export default function WeddingSelection() {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const navigate = useNavigate();

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [partnerImage, setPartnerImage] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [kibbe, setKibbe] = useState<string>("");
  const [archetypes, setArchetypes] = useState<string[]>([]);
  const [colortypes, setColortypes] = useState<string[]>([]);
  const [hairLength, setHairLength] = useState<string>("");
  const [hairColor, setHairColor] = useState<string>("");
  const [eyeColor, setEyeColor] = useState<string>("");
  const [season, setSeason] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [venue, setVenue] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [dayTime, setDayTime] = useState<string>("");
  const [styleMode, setStyleMode] = useState<string>(STYLE_MODES[0]);
  const [weddingStyle, setWeddingStyle] = useState<string>("");
  const [customStyle, setCustomStyle] = useState<string>("");
  const [weddingColors, setWeddingColors] = useState<string>("");
  const [partnerLook, setPartnerLook] = useState<string>("");
  const [dressSilhouette, setDressSilhouette] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [favoriteFabrics, setFavoriteFabrics] = useState<string[]>([]);
  const [dislikedFabrics, setDislikedFabrics] = useState<string[]>([]);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [dislikedColors, setDislikedColors] = useState<string[]>([]);
  const [customFavoriteFabrics, setCustomFavoriteFabrics] = useState("");
  const [customDislikedFabrics, setCustomDislikedFabrics] = useState("");
  const [customFavoriteColors, setCustomFavoriteColors] = useState("");
  const [customDislikedColors, setCustomDislikedColors] = useState("");
  const [highlight, setHighlight] = useState<string>("");
  const [hide, setHide] = useState<string>("");
  const [restrictions, setRestrictions] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  const [sourceLooks, setSourceLooks] = useState<SourceLook[]>([]);
  const [styleLookId, setStyleLookId] = useState<string>("");
  const [partnerLookId, setPartnerLookId] = useState<string>("");
  const [loadingLook, setLoadingLook] = useState(false);

  const [profiles, setProfiles] = useState<OutfitProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileComment, setProfileComment] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { resultRef, scrollToResult } = useScrollToResult<HTMLDivElement>();
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultData, setResultData] = useState<WeddingResult | null>(null);
  const [resultParams, setResultParams] = useState<WeddingFormParams | null>(
    null,
  );
  const [resultNote, setResultNote] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isBride = role === "Невеста";
  const styleFromLook = styleMode === STYLE_MODES[1];
  const styleFromSaved = styleMode === STYLE_MODES[2];

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if ((resultUrl || resultData) && !isAnalyzing) scrollToResult();
  }, [resultUrl, resultData, isAnalyzing, scrollToResult]);

  const loadProfiles = () => {
    if (!user) return;
    fetchOutfitProfiles("wedding")
      .then(setProfiles)
      .catch(() => {});
  };

  useEffect(() => {
    loadProfiles();
    if (user) {
      fetchSourceLooks()
        .then(setSourceLooks)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /** Берём стиль торжества из ранее созданного образа. */
  const applyStyleFromLook = async (id: string) => {
    setStyleLookId(id);
    if (!id) return;
    setLoadingLook(true);
    try {
      const detail = await fetchLookDetail(id);
      const text = buildStyleFromLook(detail);
      if (!text) {
        toast.error("В этом образе нет описания стиля");
        return;
      }
      setCustomStyle(text);
      setWeddingStyle("");
      toast.success("Стиль взят из выбранного образа");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить образ");
    } finally {
      setLoadingLook(false);
    }
  };

  /** Берём образ партнёра из ранее созданного образа: картинка + описание наряда. */
  const applyPartnerFromLook = async (id: string) => {
    setPartnerLookId(id);
    if (!id) return;
    setLoadingLook(true);
    try {
      const detail = await fetchLookDetail(id);
      const text = buildPartnerLookText(detail);
      if (text) setPartnerLook(text);
      setPartnerImage(detail.imageUrl || null);
      if (!text && !detail.imageUrl) {
        toast.error("В этом образе нет данных для подстановки");
        return;
      }
      toast.success("Образ партнёра подставлен");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить образ");
    } finally {
      setLoadingLook(false);
    }
  };

  const toggleMulti = (
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    max: number,
  ) => {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value));
    } else {
      if (list.length >= max) {
        toast.error(`Можно выбрать не более ${max}`);
        return;
      }
      setList([...list, value]);
    }
  };

  const toggleTag = (
    value: string,
    setList: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setList((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
  };

  const resizeImage = (base64Str: string, maxSize: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height: h } = img;
        if (width > maxSize || h > maxSize) {
          const ratio = width / h;
          if (width > h) {
            width = maxSize;
            h = width / ratio;
          } else {
            h = maxSize;
            width = h * ratio;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, h);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = base64Str;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Неверный файл");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const resized = await resizeImage(reader.result as string, 1280);
      setUploadedImage(resized);
    };
    reader.readAsDataURL(file);
  };

  const handlePartnerImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Неверный файл");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const resized = await resizeImage(reader.result as string, 1024);
      setPartnerImage(resized);
    };
    reader.readAsDataURL(file);
  };

  const pollTaskStatus = async (id: string) => {
    try {
      const token = localStorage.getItem("session_token");
      const response = await fetch(`${STATUS_API}?task_id=${id}`, {
        headers: token ? { "X-Session-Token": token } : {},
        credentials: "include",
      });
      const data = await response.json();

      if (data.status === "completed") {
        if (pollingIntervalRef.current)
          clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        // Картинки может не быть: разбор готов, деньги возвращены — показываем текст.
        if (!data.cdn_url && !data.result) {
          setIsAnalyzing(false);
          setAnalysisStatus("");
          toast.error("Не удалось получить результат. Попробуйте ещё раз.");
          return;
        }
        setResultUrl(data.cdn_url || null);
        setResultNote(!data.cdn_url && data.error ? data.error : null);
        if (data.result) setResultData(data.result as WeddingResult);
        if (data.form_params)
          setResultParams(data.form_params as WeddingFormParams);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        playReadySound();
        if (data.cdn_url) {
          toast.success("Свадебный образ готов!");
        } else {
          toast.warning("Разбор готов, но картинку создать не удалось");
        }
        refreshBalance();
      } else if (data.status === "failed") {
        if (pollingIntervalRef.current)
          clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error(data.error || "Ошибка подбора. Попробуйте ещё раз.");
        refreshBalance();
      } else if (data.status === "processing") {
        setAnalysisStatus("Собираем свадебный образ и рисуем картинку...");
      } else if (data.status === "pending") {
        setAnalysisStatus("Готовим запуск...");
      }
    } catch (error) {
      console.error("[WeddingSelection] Polling error:", error);
    }
  };

  const buildFormParams = (): WeddingFormParams => {
    let heightNum: number | undefined;
    if (height) {
      const n = parseInt(height, 10);
      if (!isNaN(n) && n >= 100 && n <= 250) heightNum = n;
    }
    const styleFinal = styleFromLook
      ? ""
      : customStyle.trim() || weddingStyle;
    return {
      role,
      height: heightNum,
      age: age.trim(),
      kibbe,
      archetypes,
      colortypes,
      hair_length: hairLength,
      hair_color: hairColor.trim(),
      eye_color: eyeColor.trim(),
      season,
      month,
      venue,
      location: location.trim(),
      day_time: dayTime,
      style_mode: styleFromLook
        ? "От обратного"
        : styleFromSaved
          ? "Взят из готового образа клиента"
          : "Задан клиентом",
      wedding_style: styleFinal,
      wedding_colors: weddingColors.trim(),
      partner_look: partnerLook.trim(),
      has_partner_photo: !!partnerImage,
      favorite_fabrics: mergeCustom(favoriteFabrics, customFavoriteFabrics),
      disliked_fabrics: mergeCustom(dislikedFabrics, customDislikedFabrics),
      favorite_colors: mergeCustom(favoriteColors, customFavoriteColors),
      disliked_colors: mergeCustom(dislikedColors, customDislikedColors),
      tags,
      dress_silhouette: isBride ? dressSilhouette : "",
      highlight: highlight.trim(),
      hide: hide.trim(),
      restrictions: restrictions.trim(),
      budget: budget.trim(),
      comment: comment.trim(),
    };
  };

  const buildAutoComment = (): string => {
    const parts: string[] = [];
    if (role) parts.push(role.toLowerCase());
    if (season) parts.push(`сезон: ${season}`);
    const st = customStyle.trim() || weddingStyle;
    if (st) parts.push(`стиль: ${st}`);
    return parts.join("; ");
  };

  const applyProfile = (id: string) => {
    setSelectedProfileId(id);
    if (!id) return;
    const profile = profiles.find((p) => String(p.id) === id);
    if (!profile) return;
    const fp = (profile.form_params || {}) as WeddingFormParams;
    setRole(fp.role || "");
    setHeight(fp.height ? String(fp.height) : "");
    setAge(fp.age ? String(fp.age) : "");
    setKibbe(fp.kibbe || "");
    setArchetypes(fp.archetypes || []);
    setColortypes(fp.colortypes || []);
    setHairLength(fp.hair_length || "");
    setHairColor(fp.hair_color || "");
    setEyeColor(fp.eye_color || "");
    setSeason(fp.season || "");
    setMonth(fp.month || "");
    setVenue(fp.venue || "");
    setLocation(fp.location || "");
    setDayTime(fp.day_time || "");
    const savedStyle = fp.wedding_style || "";
    const fromLook = (fp.style_mode || "").toLowerCase().includes("обратн");
    setStyleMode(fromLook ? STYLE_MODES[1] : STYLE_MODES[0]);
    const isKnownStyle = WEDDING_STYLES.includes(savedStyle);
    setWeddingStyle(isKnownStyle ? savedStyle : "");
    setCustomStyle(isKnownStyle ? "" : savedStyle);
    setWeddingColors(fp.wedding_colors || "");
    setPartnerLook(fp.partner_look || "");
    setDressSilhouette(fp.dress_silhouette || "");
    setTags(fp.tags || []);
    setFavoriteFabrics(fp.favorite_fabrics || []);
    setDislikedFabrics(fp.disliked_fabrics || []);
    setFavoriteColors(fp.favorite_colors || []);
    setDislikedColors(fp.disliked_colors || []);
    setCustomFavoriteFabrics("");
    setCustomDislikedFabrics("");
    setCustomFavoriteColors("");
    setCustomDislikedColors("");
    setHighlight(fp.highlight || "");
    setHide(fp.hide || "");
    setRestrictions(fp.restrictions || "");
    setBudget(fp.budget ? String(fp.budget) : "");
    setComment(fp.comment || "");
    toast.success(`Анкета «${profile.name}» загружена`);
  };

  const openSaveDialog = () => {
    if (!user) {
      toast.error("Войдите в аккаунт, чтобы сохранять анкеты");
      navigate("/login");
      return;
    }
    setProfileName("");
    setProfileComment(buildAutoComment());
    setSaveDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("Введите название анкеты");
      return;
    }
    setSavingProfile(true);
    try {
      await saveOutfitProfile({
        name: profileName.trim(),
        comment: profileComment.trim(),
        form_params: buildFormParams() as unknown as Record<string, unknown>,
        service_type: "wedding",
      });
      toast.success("Анкета сохранена");
      setSaveDialogOpen(false);
      loadProfiles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      toast.error("Войдите в аккаунт");
      navigate("/login");
      return;
    }
    if (!uploadedImage) {
      toast.error("Загрузите фото в полный рост");
      return;
    }
    if (!role) {
      toast.error("Укажите, для кого подбираем образ");
      return;
    }
    if (!styleFromLook && !weddingStyle && !customStyle.trim()) {
      toast.error(
        "Выберите стиль торжества или переключитесь на подбор от образа",
      );
      return;
    }

    let heightNum: number | undefined;
    if (height) {
      const n = parseInt(height, 10);
      if (!isNaN(n) && n >= 100 && n <= 250) heightNum = n;
    }

    const formParams = buildFormParams();

    setIsAnalyzing(true);
    setAnalysisStatus("Запуск подбора...");
    setResultUrl(null);
    setResultData(null);
    scrollToResult();

    try {
      const token = localStorage.getItem("session_token");
      const response = await fetch(START_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Session-Token": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          person_image: uploadedImage,
          partner_image: partnerImage || undefined,
          service_type: "wedding",
          height: heightNum,
          form_params: formParams,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          toast.error(`Недостаточно средств. Требуется ${COST} ₽`);
          navigate("/profile/wallet");
          setIsAnalyzing(false);
          return;
        }
        throw new Error(data.error || "Failed to start");
      }

      const newTaskId = data.task_id;
      setAnalysisStatus("Обработка начата...");

      pollingIntervalRef.current = setInterval(() => {
        pollTaskStatus(newTaskId);
      }, POLLING_INTERVAL);

      timeoutRef.current = setTimeout(() => {
        if (pollingIntervalRef.current)
          clearInterval(pollingIntervalRef.current);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error("Подбор занял слишком много времени. Попробуйте ещё раз.", {
          duration: 10000,
        });
      }, TIMEOUT_DURATION);
    } catch (error) {
      setIsAnalyzing(false);
      setAnalysisStatus("");
      toast.error(
        error instanceof Error ? error.message : "Ошибка запуска подбора",
      );
    }
  };

  const handleReset = () => {
    setResultUrl(null);
    setResultData(null);
    setResultParams(null);
    setUploadedImage(null);
    setPartnerImage(null);
    setStyleLookId("");
    setPartnerLookId("");
    setResultNote(null);
    setRole("");
    setHeight("");
    setAge("");
    setKibbe("");
    setArchetypes([]);
    setColortypes([]);
    setHairLength("");
    setHairColor("");
    setEyeColor("");
    setSeason("");
    setMonth("");
    setVenue("");
    setLocation("");
    setDayTime("");
    setStyleMode(STYLE_MODES[0]);
    setWeddingStyle("");
    setCustomStyle("");
    setWeddingColors("");
    setPartnerLook("");
    setDressSilhouette("");
    setTags([]);
    setFavoriteFabrics([]);
    setDislikedFabrics([]);
    setFavoriteColors([]);
    setDislikedColors([]);
    setCustomFavoriteFabrics("");
    setCustomDislikedFabrics("");
    setCustomFavoriteColors("");
    setCustomDislikedColors("");
    setHighlight("");
    setHide("");
    setRestrictions("");
    setBudget("");
    setComment("");
  };

  const handleEdit = () => {
    setResultUrl(null);
    setResultData(null);
    setResultParams(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="w-full mx-auto max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Свадебный образ
            </h2>
            <p className="text-muted-foreground text-lg">
              Полный образ для невесты или жениха: наряд, обувь, украшения,
              аксессуары, макияж и причёска — под вашу внешность, сезон и стиль
              торжества
            </p>
          </div>

          {!resultUrl && !resultData && !isAnalyzing && (
            <div className="relative">
              <LockedFormOverlay cost={COST}>
                <Card>
                  <CardContent className="p-6 md:p-8 space-y-8">
                    {user && profiles.length > 0 && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <p className="font-medium mb-2 flex items-center gap-2">
                          <Icon
                            name="Bookmark"
                            size={18}
                            className="text-primary"
                          />
                          Быстрое заполнение из сохранённой анкеты
                        </p>
                        <Select
                          value={selectedProfileId}
                          onValueChange={applyProfile}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите анкету" />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                                {p.comment ? ` — ${p.comment}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="font-medium mb-3">
                          Фото в полный рост{" "}
                          <span className="text-destructive">*</span>
                        </p>
                        <label
                          htmlFor="wedding-photo"
                          className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/40 transition-colors min-h-[260px]"
                        >
                          {uploadedImage ? (
                            <img
                              src={uploadedImage}
                              alt="Загруженное фото"
                              className="max-h-[320px] rounded-lg object-contain"
                            />
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <Icon
                                name="ImagePlus"
                                size={40}
                                className="mx-auto mb-3"
                              />
                              <p className="text-sm">
                                Загрузите фото в полный рост
                              </p>
                              <p className="text-xs mt-1">JPG, PNG, WebP</p>
                            </div>
                          )}
                          <input
                            id="wedding-photo"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="font-medium mb-2">
                            Для кого образ{" "}
                            <span className="text-destructive">*</span>
                          </p>
                          <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                              <SelectValue placeholder="Невеста или жених" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="font-medium mb-2">Рост, см</p>
                            <Input
                              type="number"
                              min={100}
                              max={250}
                              placeholder="168"
                              value={height}
                              onChange={(e) => setHeight(e.target.value)}
                            />
                          </div>
                          <div>
                            <p className="font-medium mb-2">Возраст</p>
                            <Input
                              type="number"
                              min={16}
                              max={100}
                              placeholder="30"
                              value={age}
                              onChange={(e) => setAge(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium mb-2">
                            Типаж по Дэвиду Кибби{" "}
                            <span className="text-muted-foreground text-xs">
                              (необязательно)
                            </span>
                          </p>
                          <Select value={kibbe} onValueChange={setKibbe}>
                            <SelectTrigger>
                              <SelectValue placeholder="Не выбрано" />
                            </SelectTrigger>
                            <SelectContent>
                              {KIBBE_TYPES.map((k) => (
                                <SelectItem key={k} value={k}>
                                  {k}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                      <div>
                        <p className="font-medium mb-2">
                          Как подбираем стиль свадьбы{" "}
                          <span className="text-destructive">*</span>
                        </p>
                        <Select value={styleMode} onValueChange={setStyleMode}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STYLE_MODES.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-2">
                          {styleFromLook
                            ? "Стилист подберёт наряд, который вам максимально идёт, и от него выведет стиль всей свадьбы: палитру, декор и настроение."
                            : styleFromSaved
                              ? "Стиль, палитра и настроение возьмутся из выбранного вами готового образа."
                              : "Образ будет собран строго под выбранный вами стиль торжества."}
                        </p>
                      </div>

                      {styleFromSaved && (
                        <div>
                          <p className="font-medium mb-2">
                            Мой готовый образ — источник стиля
                          </p>
                          {sourceLooks.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Готовых образов пока нет. Выберите другой способ
                              или создайте образ — он появится здесь.
                            </p>
                          ) : (
                            <Select
                              value={styleLookId}
                              onValueChange={applyStyleFromLook}
                              disabled={loadingLook}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Выберите образ" />
                              </SelectTrigger>
                              <SelectContent>
                                {sourceLooks.map((l) => (
                                  <SelectItem key={l.id} value={l.id}>
                                    {l.title} — {l.serviceLabel}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {!styleFromLook && (
                        <div>
                          <p className="font-medium mb-2">
                            Стиль торжества и дресс-код
                            {styleFromSaved && (
                              <span className="text-muted-foreground text-xs font-normal">
                                {" "}(заполнено из выбранного образа, можно
                                отредактировать)
                              </span>
                            )}
                          </p>
                          {!styleFromSaved && (
                            <Select
                              value={weddingStyle}
                              onValueChange={setWeddingStyle}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Не выбрано" />
                              </SelectTrigger>
                              <SelectContent>
                                {WEDDING_STYLES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {styleFromSaved ? (
                            <Textarea
                              placeholder="Описание стиля появится здесь после выбора образа"
                              value={customStyle}
                              onChange={(e) => setCustomStyle(e.target.value)}
                              rows={4}
                            />
                          ) : (
                            <Input
                              className="mt-2"
                              placeholder="Или свой вариант стиля"
                              value={customStyle}
                              onChange={(e) => setCustomStyle(e.target.value)}
                            />
                          )}
                        </div>
                      )}

                      <div>
                        <p className="font-medium mb-2">
                          Цветовая гамма свадьбы{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Input
                          placeholder="Например: пыльная роза и золото"
                          value={weddingColors}
                          onChange={(e) => setWeddingColors(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">Сезон свадьбы</p>
                        <Select value={season} onValueChange={setSeason}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {WEDDING_SEASONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Месяц</p>
                        <Select value={month} onValueChange={setMonth}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="font-medium mb-2">Место проведения</p>
                        <Select value={venue} onValueChange={setVenue}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {VENUES.map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Город или страна</p>
                        <Input
                          placeholder="Например: Сочи, жаркий климат"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">Время церемонии</p>
                        <Select value={dayTime} onValueChange={setDayTime}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {DAY_TIMES.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border p-4">
                      <p className="font-medium mb-1 flex items-center gap-2">
                        <Icon
                          name="Users"
                          size={18}
                          className="text-primary"
                        />
                        Образ партнёра{" "}
                        <span className="text-muted-foreground text-xs font-normal">
                          (необязательно)
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Если образ второго уже есть — загрузите его фото и/или
                        опишите словами. Стилист согласует ваш образ с ним по
                        цвету, стилю и нарядности. Фото партнёра используется
                        только для анализа: на итоговой картинке будете вы.
                      </p>
                      {sourceLooks.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium mb-1.5">
                            Выбрать из моих готовых образов
                          </p>
                          <Select
                            value={partnerLookId}
                            onValueChange={applyPartnerFromLook}
                            disabled={loadingLook}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите образ (необязательно)" />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceLooks.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.title} — {l.serviceLabel}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        <label
                          htmlFor="wedding-partner-photo"
                          className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors min-h-[160px]"
                        >
                          {partnerImage ? (
                            <img
                              src={partnerImage}
                              alt="Образ партнёра"
                              className="max-h-[220px] rounded-lg object-contain"
                            />
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <Icon
                                name="ImagePlus"
                                size={32}
                                className="mx-auto mb-2"
                              />
                              <p className="text-sm">
                                Фото готового образа партнёра
                              </p>
                              <p className="text-xs mt-1">JPG, PNG, WebP</p>
                            </div>
                          )}
                          <input
                            id="wedding-partner-photo"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePartnerImageUpload}
                          />
                        </label>
                        <div className="flex flex-col">
                          <Textarea
                            placeholder="Опишите образ второго: например, жених в тёмно-синем костюме без галстука, обувь коричневая"
                            value={partnerLook}
                            onChange={(e) => setPartnerLook(e.target.value)}
                            rows={5}
                            className="flex-1"
                          />
                          {partnerImage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 self-start text-muted-foreground"
                              onClick={() => setPartnerImage(null)}
                            >
                              <Icon name="X" size={16} className="mr-1" />
                              Убрать фото партнёра
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-medium mb-2">
                        Архетип(ы) по Карлу Юнгу{" "}
                        <span className="text-muted-foreground text-xs">
                          (до 4, необязательно)
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ARCHETYPES.map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() =>
                              toggleMulti(
                                a,
                                archetypes,
                                setArchetypes,
                                MAX_ARCHETYPES,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                              archetypes.includes(a)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="font-medium mb-2">
                        Цветотип внешности{" "}
                        <span className="text-muted-foreground text-xs">
                          (до 2, необязательно)
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        От цветотипа зависит оттенок белого: чистый белый,
                        айвори или шампань.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {COLORTYPES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              toggleMulti(
                                c,
                                colortypes,
                                setColortypes,
                                MAX_COLORTYPES,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                              colortypes.includes(c)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="font-medium mb-2">Длина волос</p>
                        <Select
                          value={hairLength}
                          onValueChange={setHairLength}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {HAIR_LENGTHS.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Цвет волос</p>
                        <Input
                          placeholder="Например, русый"
                          value={hairColor}
                          onChange={(e) => setHairColor(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">Цвет глаз</p>
                        <Input
                          placeholder="Например, зелёные"
                          value={eyeColor}
                          onChange={(e) => setEyeColor(e.target.value)}
                        />
                      </div>
                    </div>

                    {isBride && (
                      <div>
                        <p className="font-medium mb-2">
                          Силуэт платья{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Select
                          value={dressSilhouette}
                          onValueChange={setDressSilhouette}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {DRESS_SILHOUETTES.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <TagPicker
                      title="Желаемое настроение образа"
                      options={TAGS}
                      selected={tags}
                      onToggle={(v) => toggleTag(v, setTags)}
                    />

                    <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                      <TagPicker
                        title="Ткани, которые нравятся"
                        options={FABRICS}
                        selected={favoriteFabrics}
                        onToggle={(v) => toggleTag(v, setFavoriteFabrics)}
                        custom={customFavoriteFabrics}
                        onCustomChange={setCustomFavoriteFabrics}
                      />
                      <TagPicker
                        title="Ткани, которые не нравятся"
                        options={FABRICS}
                        selected={dislikedFabrics}
                        onToggle={(v) => toggleTag(v, setDislikedFabrics)}
                        custom={customDislikedFabrics}
                        onCustomChange={setCustomDislikedFabrics}
                      />
                      <TagPicker
                        title="Цвета, которые нравятся"
                        options={COLORS}
                        selected={favoriteColors}
                        onToggle={(v) => toggleTag(v, setFavoriteColors)}
                        custom={customFavoriteColors}
                        onCustomChange={setCustomFavoriteColors}
                      />
                      <TagPicker
                        title="Цвета, которые не нравятся"
                        options={COLORS}
                        selected={dislikedColors}
                        onToggle={(v) => toggleTag(v, setDislikedColors)}
                        custom={customDislikedColors}
                        onCustomChange={setCustomDislikedColors}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">
                          Что хочется подчеркнуть{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Input
                          placeholder="Например: талию, плечи"
                          value={highlight}
                          onChange={(e) => setHighlight(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">
                          Что хочется прикрыть{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Input
                          placeholder="Например: руки выше локтя"
                          value={hide}
                          onChange={(e) => setHide(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">
                          Ограничения и особые требования{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Textarea
                          placeholder="Например: венчание — закрытые плечи, без каблука, религиозные традиции"
                          value={restrictions}
                          onChange={(e) => setRestrictions(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">
                          Бюджет на образ, ₽{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Например, 120000"
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="font-medium mb-2">
                        Комментарий{" "}
                        <span className="text-muted-foreground text-xs">
                          (необязательно)
                        </span>
                      </p>
                      <Textarea
                        placeholder="Всё, что важно учесть: пожелания, идеи, что точно не хотите..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex flex-col items-center gap-3 pt-2">
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <Button
                          size="lg"
                          className="w-full sm:w-auto max-w-full min-h-11 h-auto py-3 whitespace-normal text-center leading-snug"
                          onClick={handleAnalyze}
                        >
                          <Icon
                            name="Heart"
                            size={18}
                            className="mr-2 shrink-0"
                          />
                          <span className="min-w-0">
                            Подобрать свадебный образ за {COST} ₽
                          </span>
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full sm:w-auto max-w-full min-h-11 h-auto py-3 whitespace-normal text-center leading-snug"
                          onClick={openSaveDialog}
                        >
                          <Icon
                            name="BookmarkPlus"
                            size={18}
                            className="mr-2 shrink-0"
                          />
                          <span className="min-w-0">Сохранить анкету</span>
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Обязательны фото и роль. Чем больше укажете — тем точнее
                        образ.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </LockedFormOverlay>
            </div>
          )}

          {isAnalyzing && (
            <Card ref={resultRef}>
              <CardContent className="p-10 text-center">
                <Icon
                  name="Loader2"
                  size={48}
                  className="mx-auto mb-5 animate-spin text-primary"
                />
                <p className="text-lg font-medium mb-2">
                  {analysisStatus || "Собираем свадебный образ..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Это может занять 1–3 минуты, в редких случаях — до 5 минут. Не
                  закрывайте страницу.
                </p>
              </CardContent>
            </Card>
          )}

          {(resultUrl || resultData) && !isAnalyzing && (
            <div ref={resultRef}>
              <WeddingReport
                imageUrl={resultUrl}
                data={resultData}
                formParams={resultParams}
                note={resultNote}
                onReset={handleReset}
                onEdit={handleEdit}
              />
            </div>
          )}

          <FaqAccordion
            items={[
              {
                question: "Можно подобрать образ и невесте, и жениху?",
                answer:
                  "Да. В анкете выберите, для кого образ, и заполните форму. Чтобы получить оба образа, пройдите подбор дважды — во второй раз загрузите фото уже готового первого образа в блок «Образ партнёра» или опишите его словами, и стилист согласует образы между собой.",
              },
              {
                question: "Зачем загружать фото партнёра?",
                answer:
                  "Если образ второго уже готов — например, платье куплено или костюм выбран — загрузите его фото, и стилист разберёт по нему цвета, ткани и уровень нарядности, чтобы пара смотрелась цельно на фотографиях. Фото партнёра используется только для анализа: на итоговой картинке будете вы. Можно загрузить фото, написать описание словами или сделать и то, и другое — а можно не заполнять вовсе.",
              },
              {
                question: "Что значит «подобрать стиль от образа»?",
                answer:
                  "Если вы ещё не выбрали стиль свадьбы, стилист сначала подберёт наряд, который максимально вам идёт, а затем выведет из него стиль всего торжества: палитру, декор и настроение. Это удобно, когда хочется отталкиваться от себя, а не подгонять себя под чужой формат.",
              },
              {
                question: "Где посмотреть все созданные образы?",
                answer: user ? (
                  <div className="space-y-3">
                    <p>
                      Все свадебные образы сохраняются в личном кабинете — вы
                      можете вернуться к ним в любой момент.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/profile/history-colorguide")}
                    >
                      <Icon name="Images" size={18} className="mr-2" />
                      Мои образы
                    </Button>
                  </div>
                ) : (
                  <p>
                    Все свадебные образы сохраняются в личном кабинете. Войдите
                    в аккаунт, чтобы они были доступны вам в любой момент.
                  </p>
                ),
              },
              {
                question: "Какое фото загружать?",
                answer:
                  "Фото в полный рост, при дневном свете, на нейтральном фоне. Не в верхней одежде — она скрывает фигуру.",
              },
            ]}
          />
        </div>
      </section>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="BookmarkPlus" size={20} className="text-primary" />
              Сохранить анкету
            </DialogTitle>
            <DialogDescription>
              Сохраните заполненные параметры, чтобы быстро вернуться к ним при
              следующем подборе.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wedding-profile-name">Название анкеты</Label>
              <Input
                id="wedding-profile-name"
                className="mt-1.5"
                placeholder="Например: Образ невесты, июль"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="wedding-profile-comment">Комментарий</Label>
              <Textarea
                id="wedding-profile-comment"
                className="mt-1.5"
                placeholder="Например: выездная церемония на закате"
                value={profileComment}
                onChange={(e) => setProfileComment(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Заполнен автоматически — можно отредактировать.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={savingProfile}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile && (
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
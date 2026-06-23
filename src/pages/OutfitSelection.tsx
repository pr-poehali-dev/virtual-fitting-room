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
import { OUTFIT_SELECTION_COST } from "@/config/prices";
import { useBalance } from "@/context/BalanceContext";
import { useNavigate } from "react-router-dom";
import OutfitReport, {
  OutfitResult,
  OutfitFormParams,
} from "@/components/OutfitReport";

const START_API =
  "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
const STATUS_API =
  "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";

const COST = OUTFIT_SELECTION_COST;
const POLLING_INTERVAL = 8000;
const TIMEOUT_DURATION = 300000;

const GENDERS = ["Женский", "Мужской"];
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
const ARCHETYPES = [
  "Невинный",
  "Мудрец",
  "Искатель",
  "Бунтарь",
  "Маг",
  "Герой",
  "Любовник",
  "Шут",
  "Славный малый",
  "Заботливый",
  "Творец",
  "Правитель",
];
const COLORTYPES = [
  "Светлая весна",
  "Тёплая весна",
  "Яркая весна",
  "Светлое лето",
  "Холодное лето",
  "Мягкое лето",
  "Мягкая осень",
  "Тёплая осень",
  "Глубокая осень",
  "Глубокая зима",
  "Холодная зима",
  "Яркая зима",
];
const HAIR_LENGTHS = ["Короткие", "До плеч", "Средние", "Длинные"];
const SEASONS = [
  "Весна",
  "Лето",
  "Осень",
  "Зима",
  "Тёплая погода",
  "Прохладная погода",
  "Жара",
  "Холод / мороз",
];
const OCCASIONS = [
  "Прогулка",
  "Офис / работа",
  "Поездка на море",
  "Поход в театр",
  "Свидание",
  "Вечеринка",
  "Деловая встреча",
  "Повседневный образ",
];
const TAGS = [
  "Вау-эффект",
  "Минимализм",
  "Элегантность",
  "Дерзко",
  "Романтично",
  "Деловой шик",
  "Casual",
  "Вечерний образ",
  "Эко / sustainable",
  "Total look",
  "Монохром",
  "Акцент на аксессуары",
];

const MAX_ARCHETYPES = 4;
const MAX_COLORTYPES = 2;

export default function OutfitSelection() {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const navigate = useNavigate();

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [gender, setGender] = useState<string>("Женский");
  const [height, setHeight] = useState<string>("");
  const [kibbe, setKibbe] = useState<string>("");
  const [archetypes, setArchetypes] = useState<string[]>([]);
  const [colortypes, setColortypes] = useState<string[]>([]);
  const [hairLength, setHairLength] = useState<string>("");
  const [hairColor, setHairColor] = useState<string>("");
  const [eyeColor, setEyeColor] = useState<string>("");
  const [season, setSeason] = useState<string>("");
  const [occasion, setOccasion] = useState<string>("");
  const [customOccasion, setCustomOccasion] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState<string>("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultData, setResultData] = useState<OutfitResult | null>(null);
  const [resultParams, setResultParams] = useState<OutfitFormParams | null>(
    null,
  );

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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

  const resizeImage = (base64Str: string, maxSize: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = width / height;
          if (width > height) {
            width = maxSize;
            height = width / ratio;
          } else {
            height = maxSize;
            width = height * ratio;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
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
        if (!data.cdn_url) {
          setIsAnalyzing(false);
          setAnalysisStatus("");
          toast.error("Не удалось получить результат. Попробуйте ещё раз.");
          return;
        }
        setResultUrl(data.cdn_url);
        if (data.result) setResultData(data.result as OutfitResult);
        if (data.form_params)
          setResultParams(data.form_params as OutfitFormParams);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.success("Ваш образ готов!");
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
        setAnalysisStatus("Подбираем образ и рисуем картинку...");
      } else if (data.status === "pending") {
        setAnalysisStatus("Готовим запуск...");
      }
    } catch (error) {
      console.error("[OutfitSelection] Polling error:", error);
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

    let heightNum: number | undefined;
    if (height) {
      const n = parseInt(height, 10);
      if (!isNaN(n) && n >= 100 && n <= 250) heightNum = n;
    }

    const occasionFinal = customOccasion.trim() || occasion;

    const formParams = {
      gender,
      height: heightNum,
      kibbe,
      archetypes,
      colortypes,
      hair_length: hairLength,
      hair_color: hairColor.trim(),
      eye_color: eyeColor.trim(),
      season,
      occasion: occasionFinal,
      tags,
      comment: comment.trim(),
    };

    setIsAnalyzing(true);
    setAnalysisStatus("Запуск подбора...");
    setResultUrl(null);
    setResultData(null);

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
          service_type: "outfit",
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
    setHeight("");
    setKibbe("");
    setArchetypes([]);
    setColortypes([]);
    setHairLength("");
    setHairColor("");
    setEyeColor("");
    setSeason("");
    setOccasion("");
    setCustomOccasion("");
    setTags([]);
    setComment("");
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Подбор образов
            </h2>
            <p className="text-muted-foreground text-lg">
              Индивидуальный образ по архетипу, типажу и цветотипу — одежда,
              обувь, украшения, аксессуары, макияж и причёска по трендам этого
              года
            </p>
          </div>

          {!resultUrl && !isAnalyzing && (
            <div className="relative">
              <LockedFormOverlay cost={COST}>
                <Card>
                  <CardContent className="p-6 md:p-8 space-y-8">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="font-medium mb-3">
                          Ваше фото в полный рост
                        </p>
                        <label
                          htmlFor="outfit-photo"
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
                            id="outfit-photo"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="font-medium mb-2">Пол</p>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDERS.map((g) => (
                                <SelectItem key={g} value={g}>
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="font-medium mb-2">
                            Рост, см{" "}
                            <span className="text-muted-foreground text-xs">
                              (необязательно)
                            </span>
                          </p>
                          <Input
                            type="number"
                            min={100}
                            max={250}
                            placeholder="Например, 168"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                          />
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

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">Сезон / погода</p>
                        <Select value={season} onValueChange={setSeason}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEASONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Повод / куда</p>
                        <Select value={occasion} onValueChange={setOccasion}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {OCCASIONS.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="mt-2"
                          placeholder="Или свой вариант повода"
                          value={customOccasion}
                          onChange={(e) => setCustomOccasion(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <p className="font-medium mb-2">
                        Желаемые акценты{" "}
                        <span className="text-muted-foreground text-xs">
                          (теги)
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {TAGS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              setTags((prev) =>
                                prev.includes(t)
                                  ? prev.filter((x) => x !== t)
                                  : [...prev, t],
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                              tags.includes(t)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
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
                        placeholder="Особые пожелания: предпочтения, что любите носить, что хотите подчеркнуть..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex flex-col items-center gap-3 pt-2">
                      <Button
                        size="lg"
                        className="w-full md:w-auto"
                        onClick={handleAnalyze}
                      >
                        <Icon name="Sparkles" size={18} className="mr-2" />
                        Подобрать образ за {COST} ₽
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Все поля, кроме фото, необязательны. Чем больше укажете —
                        тем точнее образ.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </LockedFormOverlay>
            </div>
          )}

          {isAnalyzing && (
            <Card>
              <CardContent className="p-10 text-center">
                <Icon
                  name="Loader2"
                  size={48}
                  className="mx-auto mb-5 animate-spin text-primary"
                />
                <p className="text-lg font-medium mb-2">
                  {analysisStatus || "Подбираем ваш образ..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Это может занять 1–3 минуты. Не закрывайте страницу.
                </p>
              </CardContent>
            </Card>
          )}

          {resultUrl && !isAnalyzing && (
            <OutfitReport
              imageUrl={resultUrl}
              data={resultData}
              formParams={resultParams}
              onReset={handleReset}
            />
          )}
        </div>
      </section>
    </Layout>
  );
}
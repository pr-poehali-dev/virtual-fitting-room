import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { validateImageFile } from "@/utils/fileValidation";
import LockedFormOverlay from "@/components/LockedFormOverlay";
import { useAuth } from "@/context/AuthContext";
import { STYLE_ANALYSIS_COST } from "@/config/prices";
import { useBalance } from "@/context/BalanceContext";
import { useNavigate } from "react-router-dom";
import { useScrollToResult } from "@/hooks/useScrollToResult";
import StyleAnalysisReport, {
  StyleAnalysisResult,
} from "@/components/StyleAnalysisReport";
import BeautyAnalysisReport from "@/components/BeautyAnalysisReport";
import { BEAUTY_REPORTS } from "@/config/beautyReports";

const START_API =
  "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
const STATUS_API =
  "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";

const COST = STYLE_ANALYSIS_COST;
const POLLING_INTERVAL = 8000;
const TIMEOUT_DURATION = 240000;

type Service = {
  id: string;
  name: string;
  icon: string;
  available: boolean;
  fullBody: boolean;
  needsHeight: boolean;
  photoHint: string;
  extraLink?: string;
  extraPath?: string;
  extraInfo?: string;
};

const SERVICES: Service[] = [
  {
    id: "style",
    name: "Стиль одежды",
    icon: "Shirt",
    available: true,
    fullBody: true,
    needsHeight: true,
    photoHint:
      "Фото в полный рост, без верхней одежды. Встаньте прямо, лицом к камере, руки вдоль тела.",
  },
  {
    id: "kibbe",
    name: "Типаж по Кибби",
    icon: "Ruler",
    available: true,
    fullBody: true,
    needsHeight: true,
    photoHint:
      "Фото в полный рост, обязательно БЕЗ верхней одежды. Нужна облегающая или неширокая одежда, чтобы были видны линии фигуры. Встаньте прямо, лицом к камере.",
    extraLink: "Пройти бесплатный тест",
    extraPath: "/kibbe-test",
    extraInfo:
      "Хотите проверить себя? Пройдите бесплатный тест по системе Дэвида Кибби — он определит типаж по вашим ответам.",
  },
  {
    id: "hairstyle",
    name: "Причёски",
    icon: "Scissors",
    available: true,
    fullBody: false,
    needsHeight: false,
    photoHint:
      "Портрет крупным планом: лицо и волосы полностью в кадре. Без головного убора, лицо хорошо освещено.",
  },
  {
    id: "makeup",
    name: "Макияж",
    icon: "Sparkles",
    available: true,
    fullBody: false,
    needsHeight: false,
    photoHint:
      "Портрет крупным планом при дневном свете. Лучше без макияжа или с минимальным — так анализ кожи будет точнее. Без очков и фильтров.",
  },
  {
    id: "glasses",
    name: "Очки",
    icon: "Glasses",
    available: true,
    fullBody: false,
    needsHeight: false,
    photoHint:
      "Портрет анфас крупным планом, БЕЗ очков. Лицо полностью в кадре, волосы не закрывают лоб и брови.",
  },
];

const SERVICE_TITLES: Record<string, { title: string; subtitle: string }> = {
  style: {
    title: "Стилевой анализ внешности",
    subtitle:
      "Персональная инфографика по фото: стиль, палитра, образы и рекомендации",
  },
  kibbe: {
    title: "Типаж по системе Кибби",
    subtitle:
      "Определим ваш типаж по фото и покажем 3 образа, которые его раскрывают",
  },
  hairstyle: {
    title: "Подбор причёски по фото",
    subtitle:
      "Форма лица, тип волос и 3 причёски, которые вам подойдут",
  },
  makeup: {
    title: "Подбор макияжа по фото",
    subtitle:
      "Разбор кожи и колорита, подходящие текстуры и 2 готовых образа",
  },
  glasses: {
    title: "Подбор очков по фото",
    subtitle: "Форма лица, подходящие оправы и 3 примера очков на вас",
  },
};

const STATUS_TEXTS: Record<string, string> = {
  style: "Анализ внешности и создание инфографики...",
  kibbe: "Определяем типаж и рисуем образы...",
  hairstyle: "Подбираем причёски и рисуем варианты...",
  makeup: "Анализируем кожу и рисуем макияж...",
  glasses: "Подбираем оправы и рисуем примеры...",
};

export default function StyleAnalysis() {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const navigate = useNavigate();

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [height, setHeight] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>("style");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultData, setResultData] = useState<StyleAnalysisResult | null>(
    null,
  );
  const [resultService, setResultService] = useState<string>("style");

  const activeService =
    SERVICES.find((s) => s.id === serviceType) || SERVICES[0];
  const pageTitle = SERVICE_TITLES[serviceType] || SERVICE_TITLES.style;

  const handleDownload = async () => {
    if (!resultUrl) return;
    const filename = `style-analysis-${Date.now()}.png`;
    const IMAGE_PROXY_API =
      "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";
    try {
      let blob: Blob;
      const needsProxy = !resultUrl.includes("cdn.poehali.dev");

      if (needsProxy) {
        const sessionToken = localStorage.getItem("session_token");
        const proxyResponse = await fetch(IMAGE_PROXY_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ image_url: resultUrl }),
        });
        if (!proxyResponse.ok)
          throw new Error("Failed to proxy image for download");
        const proxyData = await proxyResponse.json();
        const response = await fetch(proxyData.data_url);
        blob = await response.blob();
      } else {
        const response = await fetch(resultUrl);
        blob = await response.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      toast.success("Фото скачано");
    } catch (error) {
      console.error("Failed to download image:", error);
      toast.error("Ошибка скачивания");
    }
  };

  const { resultRef, scrollToResult } = useScrollToResult<HTMLDivElement>();

  useEffect(() => {
    if (resultData) scrollToResult();
  }, [resultData, scrollToResult]);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
          toast.error("Не удалось получить результат. Попробуйте другое фото.");
          return;
        }
        setResultUrl(data.cdn_url);
        if (data.result) setResultData(data.result as StyleAnalysisResult);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.success("Ваш анализ готов!");
        refreshBalance();
      } else if (data.status === "failed") {
        if (pollingIntervalRef.current)
          clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error(data.error || "Ошибка анализа. Попробуйте ещё раз.");
        refreshBalance();
      } else if (data.status === "processing") {
        setAnalysisStatus(STATUS_TEXTS[serviceType] || STATUS_TEXTS.style);
      } else if (data.status === "pending") {
        setAnalysisStatus("Подготовка к анализу...");
      }
    } catch (error) {
      console.error("[StyleAnalysis] Polling error:", error);
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      toast.error("Войдите в аккаунт");
      navigate("/login");
      return;
    }
    if (!uploadedImage) {
      toast.error("Загрузите фото");
      return;
    }
    const heightNum = parseInt(height, 10);
    if (activeService.needsHeight) {
      if (!height || isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
        toast.error("Укажите рост от 100 до 250 см");
        return;
      }
    }

    setIsAnalyzing(true);
    setAnalysisStatus("Запуск анализа...");
    setResultUrl(null);
    setResultData(null);
    setResultService(serviceType);
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
          service_type: serviceType,
          ...(activeService.needsHeight ? { height: heightNum } : {}),
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
        throw new Error(data.error || "Failed to start analysis");
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
        toast.error("Анализ занял слишком много времени. Попробуйте ещё раз.", {
          duration: 10000,
        });
      }, TIMEOUT_DURATION);
    } catch (error) {
      setIsAnalyzing(false);
      setAnalysisStatus("");
      toast.error(
        error instanceof Error ? error.message : "Ошибка запуска анализа",
      );
    }
  };

  const handleReset = () => {
    setResultUrl(null);
    setResultData(null);
    setUploadedImage(null);
    setHeight("");
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="w-full mx-auto max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              {pageTitle.title}
            </h2>
            <p className="text-muted-foreground text-lg">
              {pageTitle.subtitle}
            </p>
          </div>

          {!resultUrl && !isAnalyzing && (
            <div className="relative">
              <LockedFormOverlay cost={COST}>
                <Card>
                  <CardContent className="p-6 md:p-8 space-y-8">
                    <div>
                      <p className="font-medium mb-3">Выберите анализ</p>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {SERVICES.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            disabled={isAnalyzing}
                            onClick={() => setServiceType(s.id)}
                            className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all cursor-pointer ${
                              serviceType === s.id
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <Icon
                              name={s.icon}
                              size={24}
                              className="text-primary"
                            />
                            <span className="text-sm font-medium leading-tight">
                              {s.name}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-start gap-3">
                          <Icon
                            name={activeService.fullBody ? "PersonStanding" : "ScanFace"}
                            size={20}
                            className="mt-0.5 shrink-0 text-primary"
                          />
                          <div>
                            <p className="text-sm font-medium mb-1">
                              {activeService.fullBody
                                ? "Нужно фото в полный рост"
                                : "Нужен портрет крупным планом"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {activeService.photoHint}
                            </p>
                          </div>
                        </div>
                      </div>

                      {activeService.extraPath && (
                        <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-4">
                          <div className="flex items-start gap-3">
                            <Icon
                              name="Info"
                              size={20}
                              className="mt-0.5 shrink-0 text-purple-600"
                            />
                            <div>
                              <p className="text-sm text-gray-700">
                                {activeService.extraInfo}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                className="mt-3 max-w-full min-h-10 h-auto py-2.5 whitespace-normal text-center leading-snug border-purple-300 text-purple-700 hover:bg-purple-100"
                                onClick={() =>
                                  navigate(activeService.extraPath!)
                                }
                              >
                                <span className="min-w-0">
                                  {activeService.extraLink}
                                </span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <p className="font-medium mb-3">Ваше фото</p>
                            <label
                              htmlFor="style-photo"
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
                                    {activeService.fullBody
                                      ? "Загрузите фото в полный рост"
                                      : "Загрузите портрет крупным планом"}
                                  </p>
                                  <p className="text-xs mt-1">JPG, PNG, WebP</p>
                                </div>
                              )}
                              <input
                                id="style-photo"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                                disabled={isAnalyzing}
                              />
                            </label>
                          </div>

                          <div className="flex flex-col gap-4">
                            {activeService.needsHeight && (
                              <div>
                                <p className="font-medium mb-3">Ваш рост, см</p>
                                <Input
                                  type="number"
                                  min={100}
                                  max={250}
                                  placeholder="например, 168"
                                  value={height}
                                  onChange={(e) => setHeight(e.target.value)}
                                  disabled={isAnalyzing}
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                  Рост нужен, чтобы точнее определить пропорции
                                  фигуры.
                                </p>
                              </div>
                            )}
                            <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                              <p className="flex items-center gap-2 mb-2 text-foreground font-medium">
                                <Icon name="Info" size={16} /> Как это работает
                              </p>
                              {activeService.photoHint} Снимайте при дневном
                              свете, желательно на нейтральном не слишком
                              детализированном фоне. Анализ занимает 2–3 минуты,
                              результат — подробный разбор и картинка, которые
                              можно скачать.
                            </div>
                          </div>
                        </div>

                        <Button
                          size="lg"
                          className="w-full max-w-full min-h-11 h-auto py-3 whitespace-normal text-center leading-snug"
                          onClick={handleAnalyze}
                          disabled={isAnalyzing || !uploadedImage}
                        >
                          {isAnalyzing ? (
                            <>
                              <Icon
                                name="Loader2"
                                size={18}
                                className="mr-2 animate-spin shrink-0"
                              />
                              <span className="min-w-0">
                                {analysisStatus || "Обработка..."}
                              </span>
                            </>
                          ) : (
                            <span className="min-w-0">
                              Анализировать за {COST} ₽
                            </span>
                          )}
                        </Button>
                      </>
                  </CardContent>
                </Card>
              </LockedFormOverlay>
            </div>
          )}

          {isAnalyzing && !resultUrl && (
            <Card ref={resultRef}>
              <CardContent className="p-10 flex flex-col items-center justify-center text-center min-h-[340px]">
                <Icon
                  name="Loader2"
                  size={48}
                  className="animate-spin text-primary mb-4"
                />
                <p className="text-lg font-medium mb-1">
                  {analysisStatus || "Создаём вашу инфографику..."}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Это займёт 1–2 минуты. Не закрывайте страницу — результат
                  появится здесь автоматически.
                </p>
              </CardContent>
            </Card>
          )}

          {resultData ? (
            <div className="space-y-6 animate-fade-in" ref={resultRef}>
              {BEAUTY_REPORTS[resultService] ? (
                <BeautyAnalysisReport
                  result={resultData as Record<string, unknown>}
                  imageUrl={resultUrl}
                  config={BEAUTY_REPORTS[resultService]}
                />
              ) : (
                <StyleAnalysisReport result={resultData} imageUrl={resultUrl} />
              )}
              <div className="flex justify-center">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleReset}
                  className="max-w-full min-h-11 h-auto py-3 whitespace-normal text-center leading-snug"
                >
                  <Icon name="RotateCcw" size={18} className="mr-2 shrink-0" />
                  <span className="min-w-0">Новый анализ</span>
                </Button>
              </div>
            </div>
          ) : (
            resultUrl && (
              <div className="space-y-6 animate-fade-in">
                <Card>
                  <CardContent className="p-4 md:p-6">
                    <img
                      src={resultUrl}
                      alt="Стилевой анализ"
                      className="w-full rounded-lg"
                    />
                  </CardContent>
                </Card>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" variant="default" onClick={handleDownload}>
                    <Icon name="Download" size={18} className="mr-2" />
                    Скачать
                  </Button>
                  <Button size="lg" variant="outline" onClick={handleReset}>
                    <Icon name="RotateCcw" size={18} className="mr-2" />
                    Новый анализ
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </Layout>
  );
}
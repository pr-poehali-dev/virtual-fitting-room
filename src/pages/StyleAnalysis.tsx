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
import StyleAnalysisReport, { StyleAnalysisResult } from "@/components/StyleAnalysisReport";

const START_API = "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
const STATUS_API = "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";

const COST = STYLE_ANALYSIS_COST;
const POLLING_INTERVAL = 8000;
const TIMEOUT_DURATION = 240000;

type Service = {
  id: string;
  name: string;
  icon: string;
  available: boolean;
  testLink?: boolean;
  testPath?: string;
  testInfo?: string;
};

const SERVICES: Service[] = [
  { id: "style", name: "Стиль одежды", icon: "Shirt", available: true },
  { id: "hairstyle", name: "Причёски", icon: "Scissors", available: false },
  { id: "makeup", name: "Макияж", icon: "Sparkles", available: false },
  { id: "face", name: "Анализ лица", icon: "ScanFace", available: false },
  { id: "colortype", name: "Цветотип", icon: "Palette", available: false },
  {
    id: "archetype",
    name: "Архетип по Юнгу",
    icon: "Brain",
    available: true,
    testLink: true,
    testPath: "/archetype-test",
    testInfo:
      "Определение архетипа по фото пока в разработке. Но вы уже можете бесплатно пройти тест из 36 вопросов и узнать свой ведущий архетип из 12 по системе Карла Юнга.",
  },
  {
    id: "kibbe",
    name: "Типаж по Кибби",
    icon: "Ruler",
    available: true,
    testLink: true,
    testPath: "/kibbe-test",
    testInfo:
      "Определение типажа по Кибби по фото пока в разработке. Но вы уже можете бесплатно пройти тест и узнать свой типаж из 10 по системе Дэвида Кибби.",
  },
];

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
  const [resultData, setResultData] = useState<StyleAnalysisResult | null>(null);
  const [activeTestLink, setActiveTestLink] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!resultUrl) return;
    const filename = `style-analysis-${Date.now()}.png`;
    const IMAGE_PROXY_API = "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";
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
        if (!proxyResponse.ok) throw new Error("Failed to proxy image for download");
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
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
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
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error(data.error || "Ошибка анализа. Попробуйте ещё раз.");
        refreshBalance();
      } else if (data.status === "processing") {
        setAnalysisStatus("Анализ внешности и создание инфографики...");
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
    if (!height || isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      toast.error("Укажите рост от 100 до 250 см");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus("Запуск анализа...");
    setResultUrl(null);

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
          height: heightNum,
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
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error("Анализ занял слишком много времени. Попробуйте ещё раз.", {
          duration: 10000,
        });
      }, TIMEOUT_DURATION);
    } catch (error) {
      setIsAnalyzing(false);
      setAnalysisStatus("");
      toast.error(error instanceof Error ? error.message : "Ошибка запуска анализа");
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
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">Стилевой анализ внешности</h2>
            <p className="text-muted-foreground text-lg">
              Персональная инфографика по фото: стиль, палитра, образы и рекомендации
            </p>
          </div>

          {!resultUrl && !isAnalyzing && (
            <div className="relative">
              <LockedFormOverlay cost={COST}>
                <Card>
                  <CardContent className="p-6 md:p-8 space-y-8">
                    <div>
                      <p className="font-medium mb-3">Выберите анализ</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {SERVICES.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            disabled={(!s.available && !s.testLink) || isAnalyzing}
                            onClick={() => {
                              if (s.testLink) {
                                setActiveTestLink((prev) => (prev === s.id ? null : s.id));
                              } else if (s.available) {
                                setServiceType(s.id);
                                setActiveTestLink(null);
                              }
                            }}
                            className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                              (s.testLink && activeTestLink === s.id) ||
                              (!s.testLink && !activeTestLink && serviceType === s.id)
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-primary/40"
                            } ${!s.available && !s.testLink ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <Icon name={s.icon} size={24} className="text-primary" />
                            <span className="text-sm font-medium leading-tight">{s.name}</span>
                            {!s.available && !s.testLink && (
                              <span className="absolute top-1.5 right-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                скоро
                              </span>
                            )}
                            {s.testLink && (
                              <span className="absolute top-1.5 right-1.5 text-[10px] uppercase tracking-wide text-purple-600">
                                тест
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {activeTestLink && (() => {
                        const activeService = SERVICES.find((s) => s.id === activeTestLink);
                        if (!activeService?.testPath) return null;
                        return (
                          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
                            <div className="flex items-start gap-3">
                              <Icon name="Info" size={20} className="mt-0.5 shrink-0 text-purple-600" />
                              <div>
                                <p className="text-sm text-gray-700">{activeService.testInfo}</p>
                                <Button
                                  type="button"
                                  className="mt-3 bg-purple-600 text-white hover:bg-purple-700"
                                  onClick={() => navigate(activeService.testPath!)}
                                >
                                  Пройти бесплатный тест
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {!activeTestLink && (
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
                              <Icon name="ImagePlus" size={40} className="mx-auto mb-3" />
                              <p className="text-sm">Загрузите фото в полный рост или портрет</p>
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
                        </div>
                        <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
                          <p className="flex items-center gap-2 mb-2 text-foreground font-medium">
                            <Icon name="Info" size={16} /> Как это работает
                          </p>
                          Для стилевого анализа загрузите фото <span className="text-foreground font-medium">в полный рост</span>,
                          чтобы была видна вся фигура. Снимайте при дневном свете на нейтральном фоне.
                          Анализ занимает 1–2 минуты, результат — готовая инфографика, которую можно скачать.
                        </div>
                      </div>
                    </div>

                    <Button
                      size="lg"
                      className="w-full"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !uploadedImage}
                    >
                      {isAnalyzing ? (
                        <>
                          <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                          {analysisStatus || "Обработка..."}
                        </>
                      ) : (
                        <>Анализировать за {COST} ₽</>
                      )}
                    </Button>
                    </>
                    )}
                  </CardContent>
                </Card>
              </LockedFormOverlay>
            </div>
          )}

          {isAnalyzing && !resultUrl && (
            <Card>
              <CardContent className="p-10 flex flex-col items-center justify-center text-center min-h-[340px]">
                <Icon name="Loader2" size={48} className="animate-spin text-primary mb-4" />
                <p className="text-lg font-medium mb-1">
                  {analysisStatus || "Создаём вашу инфографику..."}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Это займёт 1–2 минуты. Не закрывайте страницу — результат появится здесь
                  автоматически.
                </p>
              </CardContent>
            </Card>
          )}

          {resultData ? (
            <div className="space-y-6 animate-fade-in">
              <StyleAnalysisReport result={resultData} imageUrl={resultUrl} />
              <div className="flex justify-center">
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <Icon name="RotateCcw" size={18} className="mr-2" />
                  Новый анализ
                </Button>
              </div>
            </div>
          ) : (
            resultUrl && (
              <div className="space-y-6 animate-fade-in">
                <Card>
                  <CardContent className="p-4 md:p-6">
                    <img src={resultUrl} alt="Стилевой анализ" className="w-full rounded-lg" />
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
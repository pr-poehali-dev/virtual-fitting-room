import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import ImageCropper from "@/components/ImageCropper";
import { validateImageFile } from "@/utils/fileValidation";
import LockedFormOverlay from "@/components/LockedFormOverlay";
import { useAuth } from "@/context/AuthContext";
import { COLORGUIDE_COST } from "@/config/prices";
import { useBalance } from "@/context/BalanceContext";
import { useNavigate } from "react-router-dom";
import ColorGuideReport, { ColorGuideResult } from "@/components/ColorGuideReport";

const COLORGUIDE_START_API = "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
const COLORGUIDE_STATUS_API = "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";

const COST = COLORGUIDE_COST;
const POLLING_INTERVAL = 8000;
const TIMEOUT_DURATION = 180000;

export default function ColorGuide() {
  const { user } = useAuth();
  const { refreshBalance, balanceInfo } = useBalance();
  const navigate = useNavigate();

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const [result, setResult] = useState<ColorGuideResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const resizeImage = (base64Str: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
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
      const base64Image = reader.result as string;
      const resized = await resizeImage(base64Image, 1024, 1024);
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const targetAspectRatio = 3 / 4;
        const tolerance = 0.05;
        if (Math.abs(aspectRatio - targetAspectRatio) > tolerance) {
          setTempImageForCrop(resized);
          setShowCropper(true);
        } else {
          setUploadedImage(resized);
        }
      };
      img.src = resized;
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImage: string) => {
    setShowCropper(false);
    setTempImageForCrop(null);
    const resized = await resizeImage(croppedImage, 1024, 1024);
    setUploadedImage(resized);
  };

  const pollTaskStatus = async (id: string) => {
    try {
      const token = localStorage.getItem("session_token");
      const response = await fetch(`${COLORGUIDE_STATUS_API}?task_id=${id}`, {
        headers: token ? { "X-Session-Token": token } : {},
        credentials: "include",
      });
      const data = await response.json();

      if (data.status === "completed") {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (!data.result) {
          setIsAnalyzing(false);
          setAnalysisStatus("");
          toast.error("Не удалось получить отчёт. Попробуйте другое фото.");
          return;
        }

        setResult(data.result as ColorGuideResult);
        setPhotoUrl(data.cdn_url || uploadedImage || "");
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.success("Ваш гид по цвету готов!");
        refreshBalance();
      } else if (data.status === "failed") {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error(data.error || "Ошибка анализа. Попробуйте ещё раз.");
      } else if (data.status === "processing") {
        setAnalysisStatus("Анализ внешности и подбор палитры...");
      } else if (data.status === "pending") {
        setAnalysisStatus("Подготовка к анализу...");
      }
    } catch (error) {
      console.error("[ColorGuide] Polling error:", error);
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      toast.error("Войдите в аккаунт");
      navigate("/login");
      return;
    }

    if (!uploadedImage) {
      toast.error("Загрузите портретное фото");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus("Запуск анализа...");
    setHasTimedOut(false);
    setResult(null);
    setPhotoUrl(null);

    try {
      const token = localStorage.getItem("session_token");
      const response = await fetch(COLORGUIDE_START_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Session-Token": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ person_image: uploadedImage }),
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
        setHasTimedOut(true);
        setIsAnalyzing(false);
        setAnalysisStatus("");
        toast.error(
          "Анализ занял слишком много времени. Попробуйте ещё раз с другим фото.",
          { duration: 10000 },
        );
      }, TIMEOUT_DURATION);
    } catch (error) {
      setIsAnalyzing(false);
      setAnalysisStatus("");
      toast.error(error instanceof Error ? error.message : "Ошибка запуска анализа");
    }
  };

  const handleReset = () => {
    setResult(null);
    setPhotoUrl(null);
    setUploadedImage(null);
    setHasTimedOut(false);
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">Ваш гид по цвету</h2>
            <p className="text-muted-foreground text-lg">
              Персональная палитра, рекомендации по макияжу, украшениям и образам
            </p>
          </div>

          {!result && (
            <div className="max-w-3xl mx-auto mb-12">
              <Card className="bg-muted/50 border-primary/20">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Icon name="Info" className="text-primary mt-0.5 flex-shrink-0" size={20} />
                      <div className="space-y-2 text-sm">
                        <p className="font-medium">Что вы получите:</p>
                        <ul className="space-y-1.5 text-muted-foreground">
                          <li>• Определение цветотипа из 12 вариантов</li>
                          <li>• Палитра «носить» и «избегать» с цветами</li>
                          <li>• Подходящий макияж: помада, румяна, тени</li>
                          <li>• Металлы для украшений и оттенки волос</li>
                          <li>• Готовые капсульные сочетания для образов</li>
                          <li>• Советы стилиста — что носить и чего избегать</li>
                          <li>• Возможность скачать отчёт в PNG</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pt-2 border-t border-border/50">
                      <Icon name="Lightbulb" className="text-primary mt-0.5 flex-shrink-0" size={20} />
                      <div className="text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Совет:</span> Используйте
                          фото при дневном свете, без макияжа и фильтров — так результат будет точнее.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {result && photoUrl ? (
            <div className="space-y-6">
              <ColorGuideReport result={result} photoUrl={photoUrl} />
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={handleReset} variant="outline" size="lg">
                  <Icon name="RotateCcw" className="mr-2" size={18} />
                  Создать новый гид
                </Button>
                <Button onClick={() => navigate("/profile/history-colorguide")} variant="default" size="lg">
                  <Icon name="History" className="mr-2" size={18} />
                  В историю гидов
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <Card className="animate-scale-in">
                <CardContent className="p-8">
                  <LockedFormOverlay cost={COST}>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium mb-3">
                          Загрузите портретное фото
                        </label>
                        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                            onChange={handleImageUpload}
                            className="hidden"
                            id="guide-portrait-upload"
                            disabled={isAnalyzing}
                          />
                          <label htmlFor="guide-portrait-upload" className="cursor-pointer">
                            {uploadedImage ? (
                              <img
                                src={uploadedImage}
                                alt="Uploaded"
                                className="max-h-64 mx-auto rounded-lg"
                              />
                            ) : (
                              <div className="space-y-3">
                                <Icon name="Upload" className="mx-auto text-muted-foreground" size={48} />
                                <p className="text-muted-foreground">Нажмите для загрузки портрета</p>
                                <p className="text-xs text-muted-foreground">
                                  Фото при естественном освещении, хорошо видны волосы, кожа и глаза
                                </p>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>

                      <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !uploadedImage || !!(user && !balanceInfo?.unlimited_access && !balanceInfo?.can_generate)}
                        className="w-full"
                        size="lg"
                      >
                        {isAnalyzing ? (
                          <>
                            <Icon name="Loader2" className="mr-2 animate-spin" size={20} />
                            {analysisStatus || "Анализ..."}
                          </>
                        ) : (
                          <>
                            <Icon name="Sparkles" className="mr-2" size={20} />
                            Создать гид по цвету
                          </>
                        )}
                      </Button>

                      {!user?.unlimited_access && !isAnalyzing && (
                        <p className="text-sm text-muted-foreground text-center">
                          Стоимость: {COST} ₽
                        </p>
                      )}

                      {isAnalyzing && (
                        <div className="text-center text-sm text-muted-foreground">
                          <p>Это может занять до 2 минут</p>
                        </div>
                      )}

                      {hasTimedOut && (
                        <div className="text-center text-sm text-muted-foreground">
                          <Icon name="Clock" className="mx-auto mb-2" size={32} />
                          <p>Анализ занял слишком много времени</p>
                        </div>
                      )}
                    </div>
                  </LockedFormOverlay>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {showCropper && tempImageForCrop && (
        <ImageCropper
          image={tempImageForCrop}
          open={showCropper}
          onClose={() => {
            setShowCropper(false);
            setTempImageForCrop(null);
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={3 / 4}
        />
      )}

      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">© 2025 Virtual Fitting. Персональный гид по цвету на базе AI</p>
        </div>
      </footer>
    </Layout>
  );
}
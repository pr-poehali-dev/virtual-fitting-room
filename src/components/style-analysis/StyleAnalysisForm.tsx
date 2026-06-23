import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import LockedFormOverlay from "@/components/LockedFormOverlay";
import { useNavigate } from "react-router-dom";
import { COST, SERVICES } from "./styleAnalysisConfig";

interface StyleAnalysisFormProps {
  uploadedImage: string | null;
  height: string;
  serviceType: string;
  isAnalyzing: boolean;
  analysisStatus: string;
  activeTestLink: string | null;
  setServiceType: (v: string) => void;
  setActiveTestLink: (v: string | null | ((prev: string | null) => string | null)) => void;
  setHeight: (v: string) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAnalyze: () => void;
}

export default function StyleAnalysisForm({
  uploadedImage,
  height,
  serviceType,
  isAnalyzing,
  analysisStatus,
  activeTestLink,
  setServiceType,
  setActiveTestLink,
  setHeight,
  handleImageUpload,
  handleAnalyze,
}: StyleAnalysisFormProps) {
  const navigate = useNavigate();

  return (
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
                        setActiveTestLink((prev) =>
                          prev === s.id ? null : s.id,
                        );
                      } else if (s.available) {
                        setServiceType(s.id);
                        setActiveTestLink(null);
                      }
                    }}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                      (s.testLink && activeTestLink === s.id) ||
                      (!s.testLink &&
                        !activeTestLink &&
                        serviceType === s.id)
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40"
                    } ${!s.available && !s.testLink ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <Icon name={s.icon} size={24} className="text-primary" />
                    <span className="text-sm font-medium leading-tight">
                      {s.name}
                    </span>
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

              {activeTestLink &&
                (() => {
                  const activeService = SERVICES.find(
                    (s) => s.id === activeTestLink,
                  );
                  if (!activeService?.testPath) return null;
                  return (
                    <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
                      <div className="flex items-start gap-3">
                        <Icon
                          name="Info"
                          size={20}
                          className="mt-0.5 shrink-0 text-purple-600"
                        />
                        <div>
                          <p className="text-sm text-gray-700">
                            {activeService.testInfo}
                          </p>
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
                          <Icon
                            name="ImagePlus"
                            size={40}
                            className="mx-auto mb-3"
                          />
                          <p className="text-sm">
                            Загрузите фото в полный рост или портрет
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
                      Для стилевого анализа загрузите фото{" "}
                      <span className="text-foreground font-medium">
                        в полный рост
                      </span>
                      . Выберите свое фото при дневном свете желательно на
                      нейтральном не слишком детализированном фоне. Анализ
                      занимает 2–3 минуты, результат — готовая инфографика,
                      которую можно скачать.
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
                      <Icon
                        name="Loader2"
                        size={18}
                        className="mr-2 animate-spin"
                      />
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
  );
}

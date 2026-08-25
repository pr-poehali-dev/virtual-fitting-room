import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ColorGuideReport, { ColorGuideResult } from "@/components/ColorGuideReport";
import StyleAnalysisReport, { StyleAnalysisResult } from "@/components/StyleAnalysisReport";
import BeautyAnalysisReport from "@/components/BeautyAnalysisReport";
import { BEAUTY_REPORTS } from "@/config/beautyReports";
import OutfitReport, {
  OutfitResult,
  OutfitFormParams,
} from "@/components/OutfitReport";
import GiftReport, {
  GiftResult,
  GiftFormParams,
} from "@/components/GiftReport";
import PerfumeReport, {
  PerfumeResult,
  PerfumeFormParams,
} from "@/components/PerfumeReport";
import WeddingReport, {
  WeddingResult,
  WeddingFormParams,
} from "@/components/WeddingReport";
import ConsultReport, { ConsultResult } from "@/components/consult/ConsultReport";

const COLORGUIDE_DETAIL_API = "https://functions.poehali.dev/90841acf-1a1a-4158-a8b6-8ddd65204126";

export default function ColorGuideDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<ColorGuideResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string>("colorguide");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [styleResult, setStyleResult] = useState<StyleAnalysisResult | null>(null);
  const [outfitResult, setOutfitResult] = useState<OutfitResult | null>(null);
  const [outfitParams, setOutfitParams] = useState<OutfitFormParams | null>(
    null,
  );
  const [textResult, setTextResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [textParams, setTextParams] = useState<Record<string, unknown> | null>(
    null,
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [colortypeHistoryId, setColortypeHistoryId] = useState<string | null>(
    null,
  );

  const handleDownload = async () => {
    if (!imageUrl) return;
    const filename = `style-analysis-${Date.now()}.png`;
    const IMAGE_PROXY_API = "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";
    try {
      let blob: Blob;
      const needsProxy = !imageUrl.includes("cdn.poehali.dev");

      if (needsProxy) {
        const sessionToken = localStorage.getItem("session_token");
        const proxyResponse = await fetch(IMAGE_PROXY_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
          },
          credentials: "include",
          body: JSON.stringify({ image_url: imageUrl }),
        });
        if (!proxyResponse.ok) throw new Error("Failed to proxy image for download");
        const proxyData = await proxyResponse.json();
        const response = await fetch(proxyData.data_url);
        blob = await response.blob();
      } else {
        const response = await fetch(imageUrl);
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("session_token");
        const response = await fetch(`${COLORGUIDE_DETAIL_API}?task_id=${encodeURIComponent(id)}`, {
          headers: token ? { "X-Session-Token": token } : {},
          credentials: "include",
        });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          if (response.status === 403) {
            setErrorText("Этот отчёт принадлежит другому пользователю");
          } else if (response.status === 404) {
            setErrorText("Отчёт не найден");
          } else {
            setErrorText(data.error || "Не удалось загрузить отчёт");
          }
          return;
        }
        const svc = data.service_type || "colorguide";
        setServiceType(svc);
        setColortypeHistoryId(data.colortype_history_id || null);

        if (svc !== "colorguide") {
          // Подарки, ароматы и консультации — текстовые отчёты, картинка необязательна.
          const isTextOnly =
            svc === "gift" || svc === "perfume" || svc === "consult";
          // Картинки может не быть: разбор готов, деньги возвращены — показываем текст.
          if (
            data.status !== "completed" ||
            (!isTextOnly && !data.cdn_url && !data.result) ||
            (isTextOnly && !data.result)
          ) {
            setErrorText(data.error_message || "Отчёт ещё не готов или не удался");
            return;
          }
          setImageUrl(data.cdn_url || null);
          if (!isTextOnly && !data.cdn_url && data.error_message)
            setResultNote(data.error_message as string);
          if (isTextOnly) {
            setTextResult(data.result as Record<string, unknown>);
            if (data.form_params)
              setTextParams(data.form_params as Record<string, unknown>);
          } else if (svc === "outfit") {
            if (data.result) setOutfitResult(data.result as OutfitResult);
            if (data.form_params)
              setOutfitParams(data.form_params as OutfitFormParams);
          } else if (svc === "wedding") {
            if (data.result)
              setTextResult(data.result as Record<string, unknown>);
            if (data.form_params)
              setTextParams(data.form_params as Record<string, unknown>);
          } else if (data.result) {
            setStyleResult(data.result as StyleAnalysisResult);
          }
          return;
        }

        if (data.status !== "completed" || !data.result) {
          setErrorText(
            data.error_message || "Отчёт ещё не готов или не удался",
          );
          return;
        }
        setResult(data.result as ColorGuideResult);
        setPhotoUrl(data.cdn_url || "");
      } catch (e) {
        console.error("[ColorGuideDetail] Error:", e);
        if (!cancelled) {
          toast.error("Ошибка при загрузке отчёта");
          setErrorText("Ошибка при загрузке отчёта");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  return (
    <Layout>
      <section className="py-10">
        <div className="container mx-auto max-w-6xl px-4 md:px-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/profile/history-colorguide")}
            className="mb-6"
          >
            <Icon name="ArrowLeft" className="mr-2" size={18} />
            К истории
          </Button>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Icon name="Loader2" className="animate-spin text-primary" size={40} />
            </div>
          ) : errorText ? (
            <Card>
              <CardContent className="p-12 text-center space-y-4">
                <Icon name="AlertCircle" className="mx-auto text-muted-foreground" size={48} />
                <p className="text-muted-foreground">{errorText}</p>
                <Button onClick={() => navigate("/color-guide")}>
                  <Icon name="Sparkles" className="mr-2" size={18} />
                  Создать новый гид
                </Button>
              </CardContent>
            </Card>
          ) : serviceType === "outfit" && (outfitResult || imageUrl) ? (
            <OutfitReport
              imageUrl={imageUrl}
              data={outfitResult}
              formParams={outfitParams}
              onReset={() => navigate("/outfit-selection")}
            />
          ) : serviceType === "wedding" && (textResult || imageUrl) ? (
            <WeddingReport
              imageUrl={imageUrl}
              data={textResult as unknown as WeddingResult}
              formParams={textParams as unknown as WeddingFormParams}
              note={resultNote}
              onReset={() => navigate("/wedding-selection")}
            />
          ) : serviceType === "gift" && textResult ? (
            <GiftReport
              data={textResult as unknown as GiftResult}
              formParams={textParams as unknown as GiftFormParams}
              onReset={() => navigate("/gift-selection")}
            />
          ) : serviceType === "perfume" && textResult ? (
            <PerfumeReport
              data={textResult as unknown as PerfumeResult}
              formParams={textParams as unknown as PerfumeFormParams}
              onReset={() => navigate("/perfume-selection")}
            />
          ) : serviceType === "consult" && textResult ? (
            <div className="space-y-6">
              <ConsultReport
                data={textResult as unknown as ConsultResult}
                question={(textParams?.question as string) || ""}
                onReset={() => navigate("/consult-stylist")}
              />
              {imageUrl && (
                <Card>
                  <CardContent className="p-4 md:p-6 space-y-4">
                    <img
                      src={imageUrl}
                      alt="Изображение по консультации"
                      className="w-full rounded-lg"
                    />
                    <div className="flex justify-center">
                      <Button size="lg" onClick={handleDownload}>
                        <Icon name="Download" className="mr-2" size={18} />
                        Скачать
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : BEAUTY_REPORTS[serviceType] && styleResult ? (
            <BeautyAnalysisReport
              result={styleResult as Record<string, unknown>}
              imageUrl={imageUrl}
              config={BEAUTY_REPORTS[serviceType]}
            />
          ) : serviceType !== "colorguide" && styleResult ? (
            <StyleAnalysisReport result={styleResult} imageUrl={imageUrl} />
          ) : serviceType !== "colorguide" && imageUrl ? (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-4 md:p-6">
                  <img src={imageUrl} alt="Стилевой анализ" className="w-full rounded-lg" />
                </CardContent>
              </Card>
              <div className="flex justify-center">
                <Button size="lg" onClick={handleDownload}>
                  <Icon name="Download" className="mr-2" size={18} />
                  Скачать
                </Button>
              </div>
            </div>
          ) : result && photoUrl ? (
            <div className="space-y-6">
              <ColorGuideReport result={result} photoUrl={photoUrl} />
              {colortypeHistoryId && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/palette/${colortypeHistoryId}`)}
                  >
                    <Icon name="Palette" className="mr-2" size={18} />
                    Открыть палитру цветотипа
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </Layout>
  );
}
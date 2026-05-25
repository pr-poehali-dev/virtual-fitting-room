import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ColorGuideReport, { ColorGuideResult } from "@/components/ColorGuideReport";

const COLORGUIDE_DETAIL_API = "https://functions.poehali.dev/90841acf-1a1a-4158-a8b6-8ddd65204126";

export default function ColorGuideDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<ColorGuideResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

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
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-6xl">
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
          ) : result && photoUrl ? (
            <ColorGuideReport result={result} photoUrl={photoUrl} />
          ) : null}
        </div>
      </section>
    </Layout>
  );
}

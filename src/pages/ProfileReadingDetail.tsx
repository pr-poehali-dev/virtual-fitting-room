import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ReadingText from "@/components/divination/ReadingText";
import ReadAloud from "@/components/divination/ReadAloud";
import { DISCLAIMER_SHORT } from "@/components/divination/texts";
import { getSpread } from "@/data/divination/spreads";

const READINGS_API = "https://functions.poehali.dev/9d61578b-0a21-4bba-9fcc-37dbd5a4454d";

interface Reading {
  id: string;
  ai_response: string;
  divination_meta: {
    system?: string;
    spread?: string;
    layout?: string[];
  };
  cost: number;
  created_at: string;
}

const formatDate = (iso: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** Один расклад на отдельной странице — как отчёты других сервисов. */
export default function ProfileReadingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [reading, setReading] = useState<Reading | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        const token = localStorage.getItem("session_token") || "";
        // Отдельной выдачи по одному раскладу нет — берём из своей истории:
        // список короткий, а лишнюю функцию заводить не нужно
        const res = await fetch(`${READINGS_API}?action=history&limit=50`, {
          headers: { "X-Session-Token": token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Не удалось загрузить");
        const found = (data.items || []).find((r: Reading) => r.id === id);
        if (!found) {
          toast.error("Расклад не найден");
          navigate("/profile/history-divination");
          return;
        }
        setReading(found);
      } catch (e) {
        toast.error((e as Error).message || "Ошибка загрузки");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [authLoading, user, id, navigate]);

  const remove = async () => {
    if (!reading) return;
    const token = localStorage.getItem("session_token") || "";
    const res = await fetch(READINGS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": token,
      },
      body: JSON.stringify({ action: "delete", id: reading.id }),
    });
    const data = await res.json();
    if (!res.ok || !data.deleted) {
      toast.error("Не удалось удалить расклад");
      return;
    }
    toast.success("Расклад удалён");
    navigate("/profile/history-divination");
  };

  const spreadTitle = () => {
    const meta = reading?.divination_meta;
    const found = meta?.spread ? getSpread(meta.spread) : undefined;
    if (found) return found.title;
    return meta?.system === "tarot" ? "Расклад Таро" : "Расклад Ленорман";
  };

  return (
    <Layout>
      <section className="py-10">
        <div className="container mx-auto max-w-4xl px-4 md:px-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/profile/history-divination")}
            className="mb-6"
          >
            <Icon name="ArrowLeft" className="mr-2" size={18} />
            К моим гаданиям
          </Button>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Icon name="Loader2" className="animate-spin text-primary" size={40} />
            </div>
          ) : !reading ? null : (
            <>
              <div className="mb-6">
                <h1 className="mb-1 text-3xl font-bold">{spreadTitle()}</h1>
                <p className="text-muted-foreground">
                  {formatDate(reading.created_at)}
                  {reading.cost ? ` · ${reading.cost} \u20bd` : ""}
                </p>
              </div>

              {(reading.divination_meta?.layout || []).length > 0 && (
                <p className="mb-4 text-sm text-muted-foreground">
                  Карты:{" "}
                  {(reading.divination_meta.layout || [])
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}

              <div className="mb-4">
                <ReadAloud text={reading.ai_response} onLight />
              </div>

              <ReadingText text={reading.ai_response} />

              <p className="mt-5 text-xs text-muted-foreground">
                {DISCLAIMER_SHORT}
              </p>

              {confirm ? (
                <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <p className="mb-3 text-sm">
                    Удалить этот расклад? Вернуть его будет нельзя.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="destructive" onClick={remove}>
                      Да, удалить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirm(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-6 gap-1.5"
                  onClick={() => setConfirm(true)}
                >
                  <Icon name="Trash2" size={16} />
                  Удалить расклад
                </Button>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}

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
import {
  dialogApi,
  downloadDialogText,
  isMobileDevice,
  shareDialogText,
} from "@/components/divination/SavedDialogs";
import { getCardImageByName } from "@/data/lenormandImages";
import { getTarotImageByName } from "@/data/divination/tarotImages";

interface ReadStep {
  step_no: number;
  question: string;
  cards: string[];
  answer: string;
}

/** Одна беседа на отдельной странице — как отчёты других сервисов. */
export default function ProfileDialogDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [steps, setSteps] = useState<ReadStep[]>([]);
  const [system, setSystem] = useState("lenormand");
  const [isLoading, setIsLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [sendingMail, setSendingMail] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      const { res, data } = await dialogApi({
        action: "history",
        dialog_id: id,
      });
      if (cancelled) return;
      if (!res.ok) {
        toast.error(data.error || "Не удалось открыть беседу");
        navigate("/profile/history-divination");
        return;
      }
      setSteps(data.steps || []);
      setSystem(data.system || "lenormand");
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, id, navigate]);

  const remove = async () => {
    const { res } = await dialogApi({ action: "delete", dialog_id: id });
    if (!res.ok) {
      toast.error("Не удалось удалить беседу");
      return;
    }
    toast.success("Беседа удалена");
    navigate("/profile/history-divination");
  };

  /** Письмо себе: на компьютере системного «Поделиться» нет */
  const emailDialog = async () => {
    setSendingMail(true);
    try {
      const { res, data } = await dialogApi({
        action: "email",
        dialog_id: id,
      });
      if (!res.ok || !data.sent) {
        toast.error(data.error || "Не удалось отправить письмо");
        return;
      }
      toast.success(`Беседа отправлена на ${data.email}`);
    } finally {
      setSendingMail(false);
    }
  };

  const cardImage = (name: string) =>
    system === "tarot" ? getTarotImageByName(name) : getCardImageByName(name);

  const wholeText = steps
    .map((s) => `Вопрос ${s.step_no}. ${s.question}. Ответ. ${s.answer}`)
    .join(" ");

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
          ) : (
            <>
              <div className="mb-6">
                <h1 className="mb-1 text-3xl font-bold">Беседа с картами</h1>
                <p className="text-muted-foreground">
                  {system === "tarot" ? "Таро" : "Ленорман"} · вопросов:{" "}
                  {steps.length}
                </p>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                {steps.length > 0 && (
                  <ReadAloud
                    text={wholeText}
                    label="Слушать всю беседу"
                    onLight
                  />
                )}
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => id && shareDialogText(id)}
                >
                  <Icon
                    name={isMobileDevice() ? "Share2" : "Copy"}
                    size={16}
                  />
                  {isMobileDevice() ? "Поделиться" : "Скопировать"}
                </Button>
                {!isMobileDevice() && (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    disabled={sendingMail}
                    onClick={emailDialog}
                  >
                    <Icon
                      name={sendingMail ? "Loader2" : "Mail"}
                      size={16}
                      className={sendingMail ? "animate-spin" : ""}
                    />
                    Отправить на почту
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => id && downloadDialogText(id)}
                >
                  <Icon name="Download" size={16} />
                  Скачать
                </Button>
              </div>

              <div className="space-y-4">
                {steps.map((s) => (
                  <div key={s.step_no} className="rounded-2xl border p-4 sm:p-5">
                    <div className="mb-3 flex items-start gap-2">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {s.step_no}
                      </span>
                      <p className="flex-1 font-medium">{s.question}</p>
                    </div>

                    {(s.cards || []).length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {s.cards.map((c, i) => {
                          const img = cardImage(c);
                          return (
                            <div
                              key={`${c}-${i}`}
                              className="rounded-lg border p-1.5 text-center"
                            >
                              {img && (
                                <img
                                  src={img}
                                  alt={c}
                                  className="mx-auto h-24 w-[62px] rounded object-contain"
                                  loading="lazy"
                                />
                              )}
                              <span className="mt-1 block text-[11px] text-muted-foreground">
                                {c}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {s.answer && (
                      <div className="mb-3">
                        <ReadAloud text={s.answer} compact onLight />
                      </div>
                    )}
                    <ReadingText text={s.answer} compact />
                  </div>
                ))}
              </div>

              <p className="mt-5 text-xs text-muted-foreground">
                {DISCLAIMER_SHORT}
              </p>

              {confirm ? (
                <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <p className="mb-3 text-sm">
                    Удалить эту беседу? Вернуть её будет нельзя.
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
                  Удалить беседу
                </Button>
              )}
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import ProfileMenu from "@/components/ProfileMenu";
import { toast } from "sonner";
import ReadingText from "@/components/divination/ReadingText";
import ReadAloud from "@/components/divination/ReadAloud";
import DialogReader from "@/components/divination/DialogReader";
import { DISCLAIMER_SHORT } from "@/components/divination/texts";
import { getSpread } from "@/data/divination/spreads";

const READINGS_API = "https://functions.poehali.dev/9d61578b-0a21-4bba-9fcc-37dbd5a4454d";
const DIALOG_API = "https://functions.poehali.dev/336075f7-e6e8-4cd9-bfd5-80e6e23e187a";

const PAGE_SIZE = 20;

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

interface SavedDialog {
  dialog_id: string;
  system: string;
  status: string;
  steps_count: number;
  cards_per_step: number;
  created_at: string;
  first_question: string;
}

const formatDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const spreadTitle = (meta: Reading["divination_meta"]) => {
  const found = meta?.spread ? getSpread(meta.spread) : undefined;
  if (found) return found.title;
  return meta?.system === "tarot" ? "Расклад Таро" : "Расклад Ленорман";
};

/**
 * «Мои гадания» — история раскладов и бесед пользователя.
 * Расклады лежат в задачах ИИ, беседы — в своих таблицах,
 * поэтому показываем их двумя вкладками.
 */
export default function ProfileHistoryDivination() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"readings" | "dialogs">("readings");
  const [readings, setReadings] = useState<Reading[]>([]);
  const [dialogs, setDialogs] = useState<SavedDialog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [readDialogId, setReadDialogId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmDialogId, setConfirmDialogId] = useState<string | null>(null);

  const token = () => localStorage.getItem("session_token") || "";

  const loadReadings = useCallback(async (offset = 0) => {
    const res = await fetch(
      `${READINGS_API}?action=history&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: { "X-Session-Token": token() } },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Не удалось загрузить");
    setReadings((prev) =>
      offset === 0 ? data.items || [] : [...prev, ...(data.items || [])],
    );
    setTotal(data.total || 0);
  }, []);

  const loadDialogs = useCallback(async () => {
    const res = await fetch(DIALOG_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": token(),
      },
      body: JSON.stringify({ action: "list" }),
    });
    const data = await res.json();
    if (res.ok) setDialogs(data.items || []);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    setIsLoading(true);
    Promise.all([loadReadings(0), loadDialogs()])
      .catch((e) => toast.error(e.message || "Не удалось загрузить историю"))
      .finally(() => setIsLoading(false));
  }, [authLoading, user, navigate, loadReadings, loadDialogs]);

  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadReadings(readings.length);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const removeReading = async (id: string) => {
    const res = await fetch(READINGS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": token(),
      },
      body: JSON.stringify({ action: "delete", id }),
    });
    const data = await res.json();
    if (!res.ok || !data.deleted) {
      toast.error("Не удалось удалить расклад");
      return;
    }
    setReadings((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setConfirmId(null);
    toast.success("Расклад удалён");
  };

  const removeDialog = async (id: string) => {
    const res = await fetch(DIALOG_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": token(),
      },
      body: JSON.stringify({ action: "delete", dialog_id: id }),
    });
    if (!res.ok) {
      toast.error("Не удалось удалить беседу");
      return;
    }
    setDialogs((prev) => prev.filter((d) => d.dialog_id !== id));
    setConfirmDialogId(null);
    toast.success("Беседа удалена");
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <ProfileMenu />

          <div className="flex-1">
            <div className="mb-6">
              <h1 className="mb-2 text-3xl font-bold">Мои гадания</h1>
              <p className="text-muted-foreground">
                Здесь хранятся ваши расклады и беседы с картами. Они видны
                только вам — можно перечитать, послушать или удалить.
              </p>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              <Button
                variant={tab === "readings" ? "default" : "outline"}
                size="sm"
                onClick={() => setTab("readings")}
              >
                Расклады {total > 0 && `(${total})`}
              </Button>
              <Button
                variant={tab === "dialogs" ? "default" : "outline"}
                size="sm"
                onClick={() => setTab("dialogs")}
              >
                Беседы {dialogs.length > 0 && `(${dialogs.length})`}
              </Button>
            </div>

            {tab === "readings" && (
              <>
                {readings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center">
                    <Icon
                      name="Sparkles"
                      size={40}
                      className="mx-auto mb-3 text-muted-foreground"
                    />
                    <p className="mb-4 text-muted-foreground">
                      Раскладов пока нет
                    </p>
                    <Button onClick={() => navigate("/divination")}>
                      Сделать расклад
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {readings.map((r) => {
                      const open = openId === r.id;
                      return (
                        <div
                          key={r.id}
                          className="overflow-hidden rounded-2xl border"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : r.id)}
                            className="flex w-full items-center justify-between gap-3 p-4 text-left"
                          >
                            <span className="min-w-0">
                              <span className="block font-medium">
                                {spreadTitle(r.divination_meta)}
                              </span>
                              <span className="block text-sm text-muted-foreground">
                                {formatDate(r.created_at)}
                                {r.cost ? ` · ${r.cost} \u20bd` : ""}
                              </span>
                            </span>
                            <Icon
                              name={open ? "ChevronUp" : "ChevronDown"}
                              size={20}
                              className="shrink-0 text-muted-foreground"
                            />
                          </button>

                          {open && (
                            <div className="border-t p-4">
                              {(r.divination_meta?.layout || []).length > 0 && (
                                <p className="mb-3 text-sm text-muted-foreground">
                                  Карты:{" "}
                                  {(r.divination_meta.layout || [])
                                    .filter(Boolean)
                                    .join(", ")}
                                </p>
                              )}

                              <div className="mb-3">
                                <ReadAloud text={r.ai_response} compact />
                              </div>

                              <ReadingText text={r.ai_response} />

                              <p className="mt-4 text-xs text-muted-foreground">
                                {DISCLAIMER_SHORT}
                              </p>

                              {confirmId === r.id ? (
                                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                                  <p className="mb-2 text-sm">
                                    Удалить этот расклад? Вернуть его будет
                                    нельзя.
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => removeReading(r.id)}
                                    >
                                      Да, удалить
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setConfirmId(null)}
                                    >
                                      Отмена
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-4 gap-1.5"
                                  onClick={() => setConfirmId(r.id)}
                                >
                                  <Icon name="Trash2" size={15} />
                                  Удалить
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {readings.length < total && (
                      <div className="pt-2 text-center">
                        <Button
                          variant="outline"
                          onClick={loadMore}
                          disabled={isLoadingMore}
                          className="gap-2"
                        >
                          {isLoadingMore && (
                            <Icon
                              name="Loader2"
                              size={15}
                              className="animate-spin"
                            />
                          )}
                          Показать ещё
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {tab === "dialogs" && (
              <>
                {dialogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center">
                    <Icon
                      name="MessagesSquare"
                      size={40}
                      className="mx-auto mb-3 text-muted-foreground"
                    />
                    <p className="mb-4 text-muted-foreground">
                      Бесед с картами пока нет
                    </p>
                    <Button onClick={() => navigate("/divination")}>
                      Начать беседу
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dialogs.map((d) => (
                      <div key={d.dialog_id} className="rounded-2xl border p-4">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {d.system === "tarot" ? "Таро" : "Ленорман"} · беседа
                          </span>
                          {d.status === "active" && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                              Можно продолжить
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(d.created_at)} · вопросов: {d.steps_count}
                        </p>
                        {d.first_question && (
                          <p className="mt-2 text-sm">
                            <span className="text-muted-foreground">
                              Начало:{" "}
                            </span>
                            {d.first_question}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setReadDialogId(d.dialog_id)}
                          >
                            <Icon name="BookOpen" size={15} />
                            Читать беседу
                          </Button>
                          {d.status === "active" && (
                            <Button
                              size="sm"
                              className="gap-1.5"
                              onClick={() => navigate("/divination")}
                            >
                              <Icon name="Play" size={15} />
                              Вернуться к диалогу
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setConfirmDialogId(d.dialog_id)}
                          >
                            <Icon name="Trash2" size={15} />
                            Удалить
                          </Button>
                        </div>

                        {confirmDialogId === d.dialog_id && (
                          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                            <p className="mb-2 text-sm">
                              Удалить эту беседу? Вернуть её будет нельзя.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeDialog(d.dialog_id)}
                              >
                                Да, удалить
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmDialogId(null)}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {readDialogId && (
        <DialogReader
          dialogId={readDialogId}
          onClose={() => setReadDialogId(null)}
        />
      )}
    </Layout>
  );
}

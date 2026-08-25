import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import Layout from "@/components/Layout";
import ProfileMenu from "@/components/ProfileMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import ServiceTypeFilter from "@/components/history/ServiceTypeFilter";

const COLORGUIDE_HISTORY_API = "https://functions.poehali.dev/d894b5d6-acf1-4b38-ae86-4c3c1ad3397f";
const DB_QUERY_API = "https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9";

// Подарки, ароматы и консультации — текстовые отчёты, картинки может не быть:
// показываем заглушку сервиса.
const SERVICE_PLACEHOLDERS: Record<string, string> = {
  gift: "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/397a0fb0-ac62-44a2-acbd-588dc53419d9.jpg",
  perfume:
    "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/15bd8187-7c0a-4015-abd8-3602df61386b.jpg",
  consult:
    "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/files/54840f7d-8c0c-4428-8a0d-3ef709daabd6.jpg",
};

interface GuideTask {
  id: string;
  status: string;
  service_type?: string | null;
  service_label?: string | null;
  colortype_slug: string | null;
  colortype_name: string | null;
  cdn_url: string | null;
  cost: number;
  refunded: boolean;
  error_message?: string | null;
  created_at: string;
}

export default function ProfileHistoryColorGuide() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<GuideTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [serviceLabels, setServiceLabels] = useState<Record<string, string>>({});
  const [draftServices, setDraftServices] = useState<string[]>([]);
  const [appliedServices, setAppliedServices] = useState<string[]>([]);

  const PAGE_SIZE = 30;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const fetchHistory = async (offset = 0, services: string[] = appliedServices) => {
    if (offset === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const token = localStorage.getItem("session_token");
      const servicesParam = services.length > 0 ? `&services=${services.join(",")}` : "";
      const response = await fetch(
        `${COLORGUIDE_HISTORY_API}?limit=${PAGE_SIZE}&offset=${offset}${servicesParam}`,
        {
          headers: token ? { "X-Session-Token": token } : {},
          credentials: "include",
        },
      );
      const data = await response.json();
      if (response.ok && data.tasks) {
        setTasks((prev) =>
          offset === 0 ? data.tasks : [...prev, ...data.tasks],
        );
        if (typeof data.total === "number") setTotal(data.total);
        if (data.counts) setCounts(data.counts);
        if (data.service_labels) setServiceLabels(data.service_labels);
      } else {
        toast.error(data.error || "Не удалось загрузить историю");
      }
    } catch (e) {
      console.error("[History] Fetch error:", e);
      toast.error("Не удалось загрузить историю");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const handleApplyFilter = () => {
    setAppliedServices(draftServices);
    setTasks([]);
    fetchHistory(0, draftServices);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    if (!confirm("Удалить этот гид по цвету? Изображение также будет удалено из хранилища.")) {
      return;
    }

    setDeletingId(id);
    try {
      const token = localStorage.getItem("session_token");
      const response = await fetch(DB_QUERY_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Session-Token": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          table: "color_guide_tasks",
          action: "delete",
          where: { id },
        }),
      });
      const result = await response.json();
      if (result.success || response.ok) {
        toast.success("Гид удалён");
        const deletedType = tasks.find((t) => t.id === id)?.service_type;
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
        if (deletedType) {
          setCounts((prev) => ({
            ...prev,
            [deletedType]: Math.max(0, (prev[deletedType] || 0) - 1),
          }));
        }
      } else {
        toast.error(result.error || "Ошибка удаления");
      }
    } catch (err) {
      console.error("[History] Delete error:", err);
      toast.error("Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const getStatusBadge = (t: GuideTask) => {
    if (t.refunded) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Возврат</span>;
    }
    if (t.status === "completed") {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Готов</span>;
    }
    if (t.status === "failed") {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Ошибка</span>;
    }
    if (t.status === "processing") {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">В работе</span>;
    }
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Ожидает</span>;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />

          <div className="flex-1 min-w-0">
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-light mb-2">История гидов, стилевых анализов и подбора образов</h2>
              <p className="text-muted-foreground">Все ваши персональные отчёты</p>
            </div>

          <ServiceTypeFilter
            labels={serviceLabels}
            counts={counts}
            draft={draftServices}
            onDraftChange={setDraftServices}
            applied={appliedServices}
            onApply={handleApplyFilter}
            isLoading={isLoading}
          />

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Icon name="Loader2" className="animate-spin text-primary" size={40} />
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center space-y-4">
                <Icon name="BookOpen" className="mx-auto text-muted-foreground" size={48} />
                {appliedServices.length > 0 ? (
                  <>
                    <p className="text-muted-foreground">
                      По выбранным типам отчётов ничего не найдено
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraftServices([]);
                        setAppliedServices([]);
                        setTasks([]);
                        fetchHistory(0, []);
                      }}
                    >
                      Показать все
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">У вас ещё нет ни одного гида по цвету</p>
                    <Button onClick={() => navigate("/color-guide")}>
                      <Icon name="Sparkles" className="mr-2" size={18} />
                      Создать гид
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className={`overflow-hidden transition-all ${
                    task.status === "completed"
                      ? "cursor-pointer hover:shadow-lg hover:scale-[1.02]"
                      : "opacity-80"
                  }`}
                  onClick={() => {
                    if (task.status === "completed") {
                      navigate(`/color-guide/${task.id}`);
                    }
                  }}
                >
                  <div className="aspect-[3/4] relative bg-gray-100">
                    {task.cdn_url ||
                    SERVICE_PLACEHOLDERS[task.service_type || ""] ? (
                      <img
                        src={
                          task.cdn_url ||
                          SERVICE_PLACEHOLDERS[task.service_type || ""]
                        }
                        alt={task.colortype_name || task.service_label || "Фото"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="Image" className="text-gray-400" size={40} />
                      </div>
                    )}
                    <div className="absolute top-3 right-3">{getStatusBadge(task)}</div>
                    <button
                      onClick={(e) => handleDelete(task.id, e)}
                      disabled={deletingId === task.id}
                      className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-red-50 text-red-600 shadow-sm transition-colors disabled:opacity-50"
                      title="Удалить гид"
                    >
                      {deletingId === task.id ? (
                        <Icon name="Loader2" className="animate-spin" size={16} />
                      ) : (
                        <Icon name="Trash2" size={16} />
                      )}
                    </button>
                  </div>
                  <CardContent className="p-4">
                    {task.service_label && (
                      <span className="inline-block text-xs px-2 py-0.5 mb-2 rounded-full bg-purple-100 text-purple-700">
                        {task.service_label}
                      </span>
                    )}
                    <h3 className="font-medium text-base mb-1 truncate">
                      {task.colortype_name || (task.status === "failed" ? "Не удалось" : "Без результата")}
                    </h3>
                    <p className="text-xs text-muted-foreground">{formatDate(task.created_at)}</p>
                    {task.status === "failed" && task.error_message && (
                      <p className="text-xs text-red-600 mt-1 line-clamp-2">{task.error_message}</p>
                    )}
                    {task.status === "completed" && (
                      <div className="mt-3 flex items-center gap-1 text-sm text-primary">
                        <span>Открыть отчёт</span>
                        <Icon name="ArrowRight" size={14} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && tasks.length > 0 && tasks.length < total && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchHistory(tasks.length)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                ) : (
                  <Icon name="ChevronDown" size={18} className="mr-2" />
                )}
                Показать ещё
              </Button>
            </div>
          )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
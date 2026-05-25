import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";
import Layout from "@/components/Layout";
import ProfileMenu from "@/components/ProfileMenu";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const COLORGUIDE_HISTORY_API = "https://functions.poehali.dev/d894b5d6-acf1-4b38-ae86-4c3c1ad3397f";

interface GuideTask {
  id: string;
  status: string;
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("session_token");
      const response = await fetch(COLORGUIDE_HISTORY_API, {
        headers: token ? { "X-Session-Token": token } : {},
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok && data.tasks) {
        setTasks(data.tasks);
      } else {
        toast.error(data.error || "Не удалось загрузить историю");
      }
    } catch (e) {
      console.error("[History] Fetch error:", e);
      toast.error("Не удалось загрузить историю");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

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
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-6xl">
          <ProfileMenu />

          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-light mb-2">История гидов по цвету</h2>
            <p className="text-muted-foreground">Все ваши персональные отчёты</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Icon name="Loader2" className="animate-spin text-primary" size={40} />
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center space-y-4">
                <Icon name="BookOpen" className="mx-auto text-muted-foreground" size={48} />
                <p className="text-muted-foreground">У вас ещё нет ни одного гида по цвету</p>
                <Button onClick={() => navigate("/color-guide")}>
                  <Icon name="Sparkles" className="mr-2" size={18} />
                  Создать гид
                </Button>
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
                    {task.cdn_url ? (
                      <img
                        src={task.cdn_url}
                        alt={task.colortype_name || "Фото"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="Image" className="text-gray-400" size={40} />
                      </div>
                    )}
                    <div className="absolute top-3 right-3">{getStatusBadge(task)}</div>
                  </div>
                  <CardContent className="p-4">
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
        </div>
      </section>
    </Layout>
  );
}

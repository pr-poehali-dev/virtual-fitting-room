import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import AdminMenu from "@/components/AdminMenu";
import { getSpread } from "@/data/divination/spreads";

const ADMIN_API = "https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15";
const getAdminToken = () =>
  document.cookie
    .split("; ")
    .find((c) => c.startsWith("admin_token="))
    ?.split("=")[1] || "";

interface User {
  id: string;
  email: string;
  name: string;
}

interface Reading {
  id: string;
  user_email: string | null;
  account_name: string | null;
  system: string | null;
  spread: string | null;
  model: string | null;
  cost: number;
  refunded: boolean;
  status: string;
  created_at: string | null;
}

interface DialogRow {
  id: string;
  user_email: string | null;
  account_name: string | null;
  system: string | null;
  spread: string | null;
  model: string | null;
  status: string;
  steps_count: number;
  total_spent: number;
  created_at: string | null;
}

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const spreadName = (id: string | null, system: string | null) => {
  const found = id ? getSpread(id) : undefined;
  if (found) return found.title;
  if (id) return id;
  return system === "tarot" ? "Таро" : "Ленорман";
};

const modelName = (model: string | null) => {
  if (!model) return "—";
  if (model.includes("claude")) return "Подробная";
  if (model.includes("gemini")) return "Быстрая";
  return model;
};

/**
 * Админка: какие расклады и беседы делали пользователи.
 * Вопросы и тексты толкований здесь НЕ показываются — это личное,
 * сервер их для этой страницы даже не отдаёт.
 */
export default function AdminDivination() {
  const [users, setUsers] = useState<User[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [dialogs, setDialogs] = useState<DialogRow[]>([]);
  const [userFilter, setUserFilter] = useState<string>("all");
  const [tab, setTab] = useState<"readings" | "dialogs">("readings");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${ADMIN_API}?action=users`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setUsers(data.users || data);
    } catch {
      toast.error("Ошибка загрузки пользователей");
    }
  };

  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams({ action: "divination_history" });
    if (userFilter && userFilter !== "all") params.append("user_id", userFilter);

    setIsLoading(true);
    try {
      const response = await fetch(`${ADMIN_API}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setReadings(data.readings || []);
      setDialogs(data.dialogs || []);
      setCurrentPage(1);
    } catch {
      toast.error("Ошибка загрузки гаданий");
    } finally {
      setIsLoading(false);
    }
  }, [userFilter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const rows = tab === "readings" ? readings : dialogs;
  const paginated = rows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const totalPages = Math.ceil(rows.length / itemsPerPage);

  const spentTotal =
    readings.reduce((sum, r) => sum + (r.refunded ? 0 : r.cost || 0), 0) +
    dialogs.reduce((sum, d) => sum + (d.total_spent || 0), 0);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <AdminMenu />

          <div className="min-w-0 flex-1">
            <div className="mb-6">
              <h1 className="mb-2 text-3xl font-bold">Гадания</h1>
              <p className="text-muted-foreground">
                Кто и какие расклады делал. Вопросы пользователей и тексты
                толкований здесь не показываются — это личные данные.
              </p>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Раскладов</p>
                  <p className="text-2xl font-bold">{readings.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Бесед</p>
                  <p className="text-2xl font-bold">{dialogs.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Потрачено</p>
                  <p className="text-2xl font-bold">{spentTotal} &#8381;</p>
                </CardContent>
              </Card>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTab("readings");
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    tab === "readings"
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  }`}
                >
                  Расклады
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("dialogs");
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    tab === "dialogs"
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  }`}
                >
                  Беседы
                </button>
              </div>

              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Все пользователи" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все пользователи</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Icon name="Loader2" className="animate-spin" size={40} />
              </div>
            ) : rows.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                  Записей нет
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/50">
                        <tr className="text-left">
                          <th className="p-3 font-medium">Дата</th>
                          <th className="p-3 font-medium">Пользователь</th>
                          <th className="p-3 font-medium">Расклад</th>
                          <th className="p-3 font-medium">Гадалка</th>
                          {tab === "dialogs" && (
                            <th className="p-3 font-medium">Вопросов</th>
                          )}
                          <th className="p-3 font-medium">Стоимость</th>
                          <th className="p-3 font-medium">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((row) => {
                          const isDialog = tab === "dialogs";
                          const d = row as DialogRow;
                          const r = row as Reading;
                          return (
                            <tr key={row.id} className="border-b last:border-0">
                              <td className="whitespace-nowrap p-3">
                                {formatDate(row.created_at)}
                              </td>
                              <td className="p-3">
                                <span className="block">
                                  {row.user_email || "—"}
                                </span>
                                {row.account_name && (
                                  <span className="block text-xs text-muted-foreground">
                                    {row.account_name}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {spreadName(row.spread, row.system)}
                              </td>
                              <td className="p-3">{modelName(row.model)}</td>
                              {isDialog && (
                                <td className="p-3">{d.steps_count}</td>
                              )}
                              <td className="whitespace-nowrap p-3">
                                {isDialog ? d.total_spent : r.cost} &#8381;
                                {!isDialog && r.refunded && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    (возврат)
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {isDialog
                                  ? d.status === "active"
                                    ? "Открыта"
                                    : "Закрыта"
                                  : r.status === "completed"
                                    ? "Готов"
                                    : r.status}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      Назад
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {currentPage} из {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40"
                    >
                      Вперёд
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

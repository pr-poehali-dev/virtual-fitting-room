import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import AdminMenu from "@/components/AdminMenu";

const ADMIN_API = "https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15";
const getAdminToken = () =>
  document.cookie.split("; ").find((c) => c.startsWith("admin_token="))?.split("=")[1] || "";

interface User {
  id: string;
  email: string;
  name: string;
}

interface GuideItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: string;
  service_type?: string | null;
  colortype_slug: string | null;
  colortype_name: string | null;
  cdn_url: string | null;
  cost: number;
  refunded: boolean;
  error_message?: string | null;
  created_at: string;
}

interface GuideDetail extends GuideItem {
  result: Record<string, unknown> | null;
}

export default function AdminColorGuide() {
  const [users, setUsers] = useState<User[]>([]);
  const [items, setItems] = useState<GuideItem[]>([]);
  const [userFilter, setUserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetail, setSelectedDetail] = useState<GuideDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<GuideItem | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length >= 0) {
      fetchHistory();
    }
  }, [userFilter, statusFilter, users.length]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${ADMIN_API}?action=users`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setUsers(data.users || data);
    } catch {
      toast.error("Ошибка загрузки пользователей");
    }
  };

  const fetchHistory = async () => {
    const params = new URLSearchParams({ action: "colorguide_history" });
    if (userFilter && userFilter !== "all") params.append("user_id", userFilter);
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);

    setIsLoading(true);
    try {
      const response = await fetch(`${ADMIN_API}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
      setCurrentPage(1);
    } catch {
      toast.error("Ошибка загрузки истории");
    } finally {
      setIsLoading(false);
    }
  };

  const openDetail = async (item: GuideItem) => {
    setIsLoadingDetail(true);
    setSelectedDetail(null);
    try {
      const response = await fetch(`${ADMIN_API}?action=colorguide_detail&task_id=${item.id}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      setSelectedDetail(data as GuideDetail);
    } catch {
      toast.error("Не удалось загрузить детали");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const response = await fetch(`${ADMIN_API}?action=delete_colorguide&task_id=${itemToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!response.ok) throw new Error("Failed");
      toast.success("Задача удалена");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchHistory();
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const getStatusBadge = (it: GuideItem) => {
    if (it.refunded) return <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Возврат</span>;
    if (it.status === "completed") return <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Готов</span>;
    if (it.status === "failed") return <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Ошибка</span>;
    if (it.status === "processing") return <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">В работе</span>;
    return <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">Ожидает</span>;
  };

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginated = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />

          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <h2 className="text-3xl font-light mb-2">Гиды по цвету и стилевые анализы — задачи</h2>
              <p className="text-muted-foreground">Все запросы пользователей на гид по цвету и стилевой анализ</p>
            </div>

          <Card className="mb-4">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все пользователи" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все пользователи</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    <SelectItem value="pending">Ожидает</SelectItem>
                    <SelectItem value="processing">В работе</SelectItem>
                    <SelectItem value="completed">Готов</SelectItem>
                    <SelectItem value="failed">Ошибка</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Icon name="Loader2" className="animate-spin text-primary" size={40} />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Нет задач для отображения
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Пользователь</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Цветотип</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Статус</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">₽</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Дата</th>
                        <th className="px-4 py-3 text-center text-sm font-medium">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((it) => (
                        <tr key={it.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs font-mono text-gray-600">
                            {it.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div>{it.user_name || "—"}</div>
                            <div className="text-xs text-gray-500">{it.user_email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">{it.colortype_name || it.colortype_slug || "—"}</td>
                          <td className="px-4 py-3">{getStatusBadge(it)}</td>
                          <td className="px-4 py-3 text-sm">{it.cost?.toFixed(0)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(it.created_at).toLocaleString("ru-RU")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => openDetail(it)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Детали"
                              >
                                <Icon name="Eye" size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setItemToDelete(it);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-red-600 hover:text-red-800"
                                title="Удалить"
                              >
                                <Icon name="Trash2" size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    ←
                  </button>
                  <span className="text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDetail || isLoadingDetail} onOpenChange={() => setSelectedDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали задачи</DialogTitle>
          </DialogHeader>
          {isLoadingDetail ? (
            <div className="flex justify-center py-10">
              <Icon name="Loader2" className="animate-spin" size={32} />
            </div>
          ) : selectedDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Пользователь</p>
                  <p>{selectedDetail.user_name || "—"}</p>
                  <p className="text-xs text-gray-500">{selectedDetail.user_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Статус</p>
                  {getStatusBadge(selectedDetail)}
                </div>
                <div>
                  <p className="text-muted-foreground">Цветотип</p>
                  <p>{selectedDetail.colortype_name || selectedDetail.colortype_slug || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Стоимость</p>
                  <p>{selectedDetail.cost?.toFixed(0)} ₽</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Возврат</p>
                  <p>{selectedDetail.refunded ? "Да" : "Нет"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Дата</p>
                  <p>{new Date(selectedDetail.created_at).toLocaleString("ru-RU")}</p>
                </div>
              </div>

              {selectedDetail.cdn_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Фото пользователя</p>
                  <img
                    src={selectedDetail.cdn_url}
                    alt="Фото"
                    className="w-full max-w-md rounded-lg border"
                  />
                </div>
              )}

              {selectedDetail.error_message && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Ошибка</p>
                  <div className="text-sm bg-red-50 text-red-700 p-3 rounded">
                    {selectedDetail.error_message}
                  </div>
                </div>
              )}

              {selectedDetail.result && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">JSON-результат</p>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto max-h-96">
                    {JSON.stringify(selectedDetail.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить задачу?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Задача и её результат будут удалены навсегда. Фото в S3 НЕ удаляется.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setDeleteDialogOpen(false)}
              className="px-4 py-2 border rounded"
            >
              Отмена
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Удалить
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
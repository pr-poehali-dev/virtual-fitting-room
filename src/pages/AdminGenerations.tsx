import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';
const getAdminToken = () => document.cookie.split('; ').find(c => c.startsWith('admin_token='))?.split('=')[1] || '';

interface User {
  id: string;
  email: string;
  name: string;
}

interface GenerationHistory {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  model_used: string;
  cost: number;
  result_image: string;
  created_at: string;
}

export default function AdminGenerations() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GenerationHistory[]>([]);
  const [genUserFilter, setGenUserFilter] = useState<string>('all');
  const [genModelFilter, setGenModelFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState<string>('3');
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      fetchGenerationHistory();
    }
  }, [genUserFilter, genModelFilter, users]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${ADMIN_API}?action=users`, {
        headers: { 'Authorization': `Bearer ${getAdminToken()}` }
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || data);
    } catch (error) {
      toast.error('Ошибка загрузки пользователей');
    }
  };

  const fetchGenerationHistory = async () => {
    const isFreegen = genModelFilter === 'freegen';
    const action = isFreegen ? 'freegen_history' : 'generation_history';
    const params = new URLSearchParams({ action });

    if (genUserFilter && genUserFilter !== 'all') params.append('user_id', genUserFilter);
    if (!isFreegen && genModelFilter && genModelFilter !== 'all') {
      params.append('model', genModelFilter);
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${ADMIN_API}?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${getAdminToken()}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Для freegen_history добавляем model_used='freegen', чтобы таблица отображалась одинаково
        const normalized: GenerationHistory[] = (data as Array<Record<string, unknown>>).map((h) => ({
          id: String(h.id ?? ''),
          user_id: String(h.user_id ?? ''),
          user_email: String(h.user_email ?? ''),
          user_name: String(h.user_name ?? ''),
          model_used: String(h.model_used ?? (isFreegen ? 'freegen' : '')),
          cost: typeof h.cost === 'number' ? h.cost : 0,
          result_image: String(h.result_image ?? ''),
          created_at: String(h.created_at ?? ''),
        }));
        setGenerationHistory(normalized);
        setCurrentPage(1);
      } else {
        toast.error('Ошибка загрузки истории генераций');
      }
    } catch (error) {
      toast.error('Ошибка загрузки истории генераций');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupReferences = async () => {
    const daysNum = parseInt(cleanupDays, 10);
    if (isNaN(daysNum) || daysNum < 1) {
      toast.error('Введите число дней больше 0');
      return;
    }
    setIsCleaningUp(true);
    try {
      const res = await fetch(`${ADMIN_API}?action=cleanup_freegen_references`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAdminToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days: daysNum }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success(
        `Очищено: ${data.tasks_processed} задач, ${data.files_deleted} файлов. Ошибок: ${data.errors_count}`
      );
      setCleanupDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка очистки');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const totalCost = generationHistory.reduce((sum, gen) => sum + (gen.cost || 0), 0);

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader2" className="animate-spin" size={48} />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />
          
          <div className="flex-1">
            <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold mb-2">Генерации</h1>
                <p className="text-muted-foreground">
                  Всего генераций: {generationHistory.length} | Общая стоимость: {totalCost.toFixed(2)} ₽
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setCleanupDialogOpen(true)}
                className="gap-2"
              >
                <Icon name="Trash2" size={16} />
                Очистить референсы FreeGen
              </Button>
            </div>

            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Пользователь:</label>
                    <Select value={genUserFilter} onValueChange={setGenUserFilter}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все</SelectItem>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Модель:</label>
                    <Select value={genModelFilter} onValueChange={setGenModelFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все (примерочная)</SelectItem>
                        <SelectItem value="replicate">Replicate</SelectItem>
                        <SelectItem value="seedream">SeeDream</SelectItem>
                        <SelectItem value="nanobananapro">NanoBananaPro</SelectItem>
                        <SelectItem value="freegen">FreeGen (NanoBanana 2)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Показано {Math.min((currentPage - 1) * itemsPerPage + 1, generationHistory.length)}-{Math.min(currentPage * itemsPerPage, generationHistory.length)} из {generationHistory.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
                >
                  <Icon name="ChevronLeft" size={16} className="inline" />
                  Назад
                </button>
                <span className="text-sm">
                  Страница {currentPage} из {Math.ceil(generationHistory.length / itemsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(generationHistory.length / itemsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(generationHistory.length / itemsPerPage)}
                  className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
                >
                  Вперёд
                  <Icon name="ChevronRight" size={16} className="inline" />
                </button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Превью</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Пользователь</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Модель</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Стоимость</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generationHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((gen) => (
                        <tr key={gen.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono">
                            {gen.id.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            {gen.result_image ? (
                              <img 
                                src={gen.result_image} 
                                alt="Result" 
                                className="w-16 h-16 object-cover rounded"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                                <Icon name="Image" size={20} className="text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium">{gen.user_name}</div>
                            <div className="text-xs text-gray-500">{gen.user_email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">{gen.model_used}</td>
                          <td className="px-4 py-3 text-sm">{gen.cost?.toFixed(2)} ₽</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(gen.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Очистка референсов FreeGen</DialogTitle>
            <DialogDescription>
              Удалит файлы референсов из S3 для задач свободной генерации старше указанного количества дней.
              Результаты генерации и история — не затрагиваются.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Удалить референсы старше (дней):</label>
            <Select value={cleanupDays} onValueChange={setCleanupDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 день</SelectItem>
                <SelectItem value="3">3 дня (рекомендовано)</SelectItem>
                <SelectItem value="7">7 дней</SelectItem>
                <SelectItem value="14">14 дней</SelectItem>
                <SelectItem value="30">30 дней</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCleanupDialogOpen(false)}
              disabled={isCleaningUp}
            >
              Отмена
            </Button>
            <Button onClick={handleCleanupReferences} disabled={isCleaningUp}>
              {isCleaningUp ? (
                <>
                  <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                  Очистка…
                </>
              ) : (
                'Очистить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
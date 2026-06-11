import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';
import { getQuestions, KibbeLetter } from '@/data/kibbeTest';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';
const getAdminToken = () =>
  document.cookie.split('; ').find((c) => c.startsWith('admin_token='))?.split('=')[1] || '';

interface User {
  id: string;
  email: string;
  name: string;
}

interface KibbeItem {
  id: string;
  user_id: string;
  user_email: string;
  account_name: string;
  user_name: string;
  height: number;
  dominance: string;
  winning_letter: string;
  kibbe_type: string;
  answers: Record<string, string> | null;
  created_at: string;
}

export default function AdminKibbe() {
  const [users, setUsers] = useState<User[]>([]);
  const [items, setItems] = useState<KibbeItem[]>([]);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<KibbeItem | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchKibbeHistory();
  }, [userFilter]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${ADMIN_API}?action=users`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || data);
    } catch (error) {
      toast.error('Ошибка загрузки пользователей');
    }
  };

  const fetchKibbeHistory = async () => {
    const params = new URLSearchParams({ action: 'kibbe_history' });
    if (userFilter && userFilter !== 'all') params.append('user_id', userFilter);

    setIsLoading(true);
    try {
      const response = await fetch(`${ADMIN_API}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setItems(Array.isArray(data) ? data : []);
        setCurrentPage(1);
      } else {
        toast.error('Ошибка загрузки тестов Кибби');
      }
    } catch (error) {
      toast.error('Ошибка загрузки тестов Кибби');
    } finally {
      setIsLoading(false);
    }
  };

  const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(items.length / itemsPerPage);

  const renderAnswers = (item: KibbeItem) => {
    if (!item.answers || Object.keys(item.answers).length === 0) {
      return <p className="text-muted-foreground">Ответы не сохранены</p>;
    }
    const dominance = item.dominance === 'Вертикаль' ? 'Вертикаль' : 'Изогнутая';
    const questions = getQuestions(dominance as 'Вертикаль' | 'Изогнутая');
    return (
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const letter = item.answers?.[q.id] as KibbeLetter | undefined;
          const opt = q.options.find((o) => o.letter === letter);
          return (
            <div key={q.id} className="rounded-lg border p-3">
              <p className="font-medium mb-1">
                {idx + 1}. {q.title}
              </p>
              {letter ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-purple-700">{letter})</span>{' '}
                  {opt?.text || ''}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading && items.length === 0) {
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
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Тесты Кибби</h1>
              <p className="text-muted-foreground">Пользователи, прошедшие бесплатный тест</p>
            </div>

            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Пользователь:</label>
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {items.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Icon name="Ruler" className="mx-auto mb-4 text-muted-foreground" size={48} />
                  <p className="text-muted-foreground">Пока никто не проходил тест</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Показано {(currentPage - 1) * itemsPerPage + 1}-
                    {Math.min(currentPage * itemsPerPage, items.length)} из {items.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
                    >
                      <Icon name="ChevronLeft" size={16} className="inline" />
                    </button>
                    <span className="text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
                    >
                      <Icon name="ChevronRight" size={16} className="inline" />
                    </button>
                  </div>
                </div>

                <Card>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="p-3 font-medium">Пользователь (аккаунт)</th>
                          <th className="p-3 font-medium">Имя в тесте</th>
                          <th className="p-3 font-medium">Рост</th>
                          <th className="p-3 font-medium">Типаж</th>
                          <th className="p-3 font-medium">Дата</th>
                          <th className="p-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((item) => (
                          <tr key={item.id} className="border-b hover:bg-muted/20">
                            <td className="p-3">
                              <div className="font-medium">{item.account_name || '—'}</div>
                              <div className="text-xs text-muted-foreground">{item.user_email}</div>
                            </td>
                            <td className="p-3">{item.user_name}</td>
                            <td className="p-3">{item.height} см</td>
                            <td className="p-3">
                              <span className="font-medium text-purple-700">{item.kibbe_type}</span>
                              <div className="text-xs text-muted-foreground">{item.dominance}</div>
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {item.created_at
                                ? new Date(item.created_at).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => setSelectedItem(item)}
                                className="px-3 py-1 border rounded hover:bg-gray-100 whitespace-nowrap"
                              >
                                Ответы
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedItem?.user_name} — {selectedItem?.kibbe_type}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Аккаунт: {selectedItem.account_name} ({selectedItem.user_email}) · рост{' '}
                {selectedItem.height} см · доминанта {selectedItem.dominance} · буква-победитель{' '}
                {selectedItem.winning_letter}
              </div>
              {renderAnswers(selectedItem)}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

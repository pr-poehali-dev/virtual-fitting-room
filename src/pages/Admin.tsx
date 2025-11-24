import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

interface Lookbook {
  id: string;
  user_id: string;
  name: string;
  person_name: string;
  photos: string[];
  created_at: string;
}

interface TryOnHistory {
  id: string;
  user_id: string;
  created_at: string;
}

interface Stats {
  total_users: number;
  total_lookbooks: number;
  total_try_ons: number;
  today_try_ons: number;
}

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [filteredLookbooks, setFilteredLookbooks] = useState<Lookbook[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [history, setHistory] = useState<TryOnHistory[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_auth');
    if (adminAuth) {
      setIsAuthenticated(true);
      fetchData();
    }
  }, []);

  const handleLogin = async () => {
    if (!password) {
      toast.error('Введите пароль');
      return;
    }

    try {
      const response = await fetch(`${ADMIN_API}?action=login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password
        }
      });

      if (response.ok) {
        sessionStorage.setItem('admin_auth', password);
        setIsAuthenticated(true);
        toast.success('Вход выполнен');
        fetchData();
      } else {
        toast.error('Неверный пароль');
      }
    } catch (error) {
      toast.error('Ошибка входа');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    setIsAuthenticated(false);
    setPassword('');
  };

  const fetchData = async () => {
    setIsLoading(true);
    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const [statsRes, usersRes, lookbooksRes, historyRes] = await Promise.all([
        fetch(`${ADMIN_API}?action=stats`, {
          headers: { 'X-Admin-Password': adminPassword || '' }
        }),
        fetch(`${ADMIN_API}?action=users`, {
          headers: { 'X-Admin-Password': adminPassword || '' }
        }),
        fetch(`${ADMIN_API}?action=lookbooks`, {
          headers: { 'X-Admin-Password': adminPassword || '' }
        }),
        fetch(`${ADMIN_API}?action=history`, {
          headers: { 'X-Admin-Password': adminPassword || '' }
        })
      ]);

      if (!statsRes.ok || !usersRes.ok || !lookbooksRes.ok || !historyRes.ok) {
        throw new Error('Ошибка загрузки данных');
      }

      const [statsData, usersData, lookbooksData, historyData] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
        lookbooksRes.json(),
        historyRes.json()
      ]);

      setStats(statsData);
      setUsers(usersData);
      setLookbooks(lookbooksData);
      setFilteredLookbooks(lookbooksData);
      setHistory(historyData);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Удалить пользователя и все его данные?')) return;

    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const response = await fetch(`${ADMIN_API}?action=delete_user&user_id=${userId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword || '' }
      });

      if (response.ok) {
        toast.success('Пользователь удален');
        setSelectedUserId('all');
        fetchData();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'User ID', 'Name', 'Person Name', 'Photos Count', 'Created At'];
    const rows = filteredLookbooks.map(lb => [
      lb.id,
      lb.user_id,
      lb.name,
      lb.person_name,
      lb.photos.length.toString(),
      new Date(lb.created_at).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast.success('Файл скачан');
  };

  const handleDeleteLookbook = async (lookbookId: string) => {
    if (!confirm('Удалить лукбук?')) return;

    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const response = await fetch(`${ADMIN_API}?action=delete_lookbook&lookbook_id=${lookbookId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword || '' }
      });

      if (response.ok) {
        toast.success('Лукбук удален');
        fetchData();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Админ-панель</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  type="password"
                  placeholder="Пароль администратора"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <Button onClick={handleLogin} className="w-full">
                  Войти
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-4xl font-light mb-2">Админ-панель</h2>
              <p className="text-muted-foreground">Управление платформой</p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <Icon name="LogOut" className="mr-2" size={18} />
              Выйти
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader2" className="animate-spin" size={48} />
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Пользователей
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="Users" size={24} className="text-primary" />
                      <span className="text-3xl font-bold">{stats?.total_users || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Лукбуков
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="BookOpen" size={24} className="text-primary" />
                      <span className="text-3xl font-bold">{stats?.total_lookbooks || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Примерок всего
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="History" size={24} className="text-primary" />
                      <span className="text-3xl font-bold">{stats?.total_try_ons || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Примерок сегодня
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="TrendingUp" size={24} className="text-green-600" />
                      <span className="text-3xl font-bold">{stats?.today_try_ons || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full md:w-auto grid-cols-3 mb-8">
                  <TabsTrigger value="users">Пользователи</TabsTrigger>
                  <TabsTrigger value="lookbooks">Лукбуки</TabsTrigger>
                  <TabsTrigger value="history">История</TabsTrigger>
                </TabsList>

                <TabsContent value="users">
                  <Card>
                    <CardHeader>
                      <CardTitle>Все пользователи</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {users.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">Нет пользователей</p>
                        ) : (
                          users.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  ID: {user.id} • Создан: {new Date(user.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Icon name="Trash2" size={16} />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="lookbooks">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Все лукбуки</CardTitle>
                        <div className="flex gap-2 items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const csv = exportToCSV();
                              downloadCSV(csv, 'lookbooks.csv');
                            }}
                          >
                            <Icon name="Download" className="mr-2" size={16} />
                            Экспорт CSV
                          </Button>
                          <select
                            value={selectedUserId}
                            onChange={(e) => {
                              const userId = e.target.value;
                              setSelectedUserId(userId);
                              if (userId === 'all') {
                                setFilteredLookbooks(lookbooks);
                              } else {
                                setFilteredLookbooks(lookbooks.filter(lb => lb.user_id === userId));
                              }
                            }}
                            className="px-3 py-2 border rounded-md text-sm"
                          >
                            <option value="all">Все пользователи</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.email})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredLookbooks.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">Нет лукбуков</p>
                        ) : (
                          filteredLookbooks.map((lookbook) => (
                            <div
                              key={lookbook.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div>
                                <p className="font-medium">{lookbook.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Для: {lookbook.person_name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  User ID: {lookbook.user_id} • Фото: {lookbook.photos.length} • 
                                  Создан: {new Date(lookbook.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteLookbook(lookbook.id)}
                              >
                                <Icon name="Trash2" size={16} />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="history">
                  <Card>
                    <CardHeader>
                      <CardTitle>История примерок</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {history.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">История пуста</p>
                        ) : (
                          history.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div>
                                <p className="text-sm">ID: {item.id}</p>
                                <p className="text-xs text-muted-foreground">
                                  User ID: {item.user_id} • {new Date(item.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
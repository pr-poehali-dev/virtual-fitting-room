import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import ImageCropper from '@/components/ImageCropper';

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

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  created_at: string;
}

interface FilterOption {
  id: number;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
}

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';
const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [filteredLookbooks, setFilteredLookbooks] = useState<Lookbook[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [history, setHistory] = useState<TryOnHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<TryOnHistory[]>([]);
  const [selectedHistoryUserId, setSelectedHistoryUserId] = useState<string>('all');
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [showAddClothing, setShowAddClothing] = useState(false);
  const [editingClothing, setEditingClothing] = useState<ClothingItem | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [newClothing, setNewClothing] = useState({
    image_url: '',
    name: '',
    description: '',
    category_ids: [] as number[],
    color_ids: [] as number[],
    archetype_ids: [] as number[]
  });
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [cropMode, setCropMode] = useState<'new' | 'edit'>('new');

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

  const fetchCatalogData = async () => {
    try {
      const [filtersRes, catalogRes] = await Promise.all([
        fetch(`${CATALOG_API}?action=filters`),
        fetch(`${CATALOG_API}?action=list`)
      ]);

      if (!filtersRes.ok || !catalogRes.ok) {
        throw new Error('Ошибка загрузки каталога');
      }

      const [filtersData, catalogData] = await Promise.all([
        filtersRes.json(),
        catalogRes.json()
      ]);

      setFilters(filtersData);
      setClothingItems(catalogData);
    } catch (error) {
      toast.error('Ошибка загрузки каталога');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const [statsRes, usersRes, lookbooksRes, historyRes, filtersRes, catalogRes] = await Promise.all([
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
        }),
        fetch(`${CATALOG_API}?action=filters`),
        fetch(`${CATALOG_API}?action=list`)
      ]);

      if (!statsRes.ok || !usersRes.ok || !lookbooksRes.ok || !historyRes.ok || !filtersRes.ok || !catalogRes.ok) {
        throw new Error('Ошибка загрузки данных');
      }

      const [statsData, usersData, lookbooksData, historyData, filtersData, catalogData] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
        lookbooksRes.json(),
        historyRes.json(),
        filtersRes.json(),
        catalogRes.json()
      ]);

      setStats(statsData);
      setUsers(usersData);
      setLookbooks(lookbooksData);
      setFilteredLookbooks(lookbooksData);
      setHistory(historyData);
      setFilteredHistory(historyData);
      setFilters(filtersData);
      setClothingItems(catalogData);
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
        setSelectedHistoryUserId('all');
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

  const handleImageUrlInput = (url: string) => {
    setNewClothing({ ...newClothing, image_url: url });
  };

  const handleCropImage = () => {
    if (!newClothing.image_url) {
      toast.error('Сначала добавьте ссылку на изображение');
      return;
    }
    setImageToCrop(newClothing.image_url);
    setCropMode('new');
    setShowCropper(true);
  };

  const handleCropEditingImage = () => {
    if (!editingClothing?.image_url) {
      toast.error('Изображение отсутствует');
      return;
    }
    setImageToCrop(editingClothing.image_url);
    setCropMode('edit');
    setShowCropper(true);
  };

  const handleCropComplete = (croppedImage: string) => {
    if (cropMode === 'new') {
      setNewClothing({ ...newClothing, image_url: croppedImage });
    } else if (cropMode === 'edit' && editingClothing) {
      setEditingClothing({ ...editingClothing, image_url: croppedImage });
    }
    setShowCropper(false);
    toast.success('Изображение обрезано');
  };

  const handleAddClothing = async () => {
    if (!newClothing.image_url) {
      toast.error('Добавьте ссылку на изображение');
      return;
    }

    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const response = await fetch(CATALOG_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword || ''
        },
        body: JSON.stringify(newClothing)
      });

      if (response.ok) {
        toast.success('Одежда добавлена в каталог');
        setShowAddClothing(false);
        setNewClothing({
          image_url: '',
          name: '',
          description: '',
          category_ids: [],
          color_ids: [],
          archetype_ids: []
        });
        fetchCatalogData();
      } else {
        toast.error('Ошибка добавления');
      }
    } catch (error) {
      toast.error('Ошибка добавления');
    }
  };

  const handleEditClothing = (item: ClothingItem) => {
    setEditingClothing(item);
  };

  const handleUpdateClothing = async () => {
    if (!editingClothing) return;

    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const categoryIds = filters?.categories
        .filter(cat => editingClothing.categories.includes(cat.name))
        .map(cat => cat.id) || [];
      
      const colorIds = filters?.colors
        .filter(col => editingClothing.colors.includes(col.name))
        .map(col => col.id) || [];
      
      const archetypeIds = filters?.archetypes
        .filter(arch => editingClothing.archetypes.includes(arch.name))
        .map(arch => arch.id) || [];

      const response = await fetch(CATALOG_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword || ''
        },
        body: JSON.stringify({
          id: editingClothing.id,
          image_url: editingClothing.image_url,
          name: editingClothing.name,
          description: editingClothing.description,
          category_ids: categoryIds,
          color_ids: colorIds,
          archetype_ids: archetypeIds
        })
      });

      if (response.ok) {
        toast.success('Элемент обновлен');
        setEditingClothing(null);
        fetchCatalogData();
      } else {
        toast.error('Ошибка обновления');
      }
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  const handleRemoveBackground = async () => {
    if (!editingClothing) return;

    setIsProcessingImage(true);
    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const response = await fetch(`${CATALOG_API}?action=remove_bg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword || ''
        },
        body: JSON.stringify({
          id: editingClothing.id,
          image_url: editingClothing.image_url
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEditingClothing({
          ...editingClothing,
          image_url: data.processed_image_url
        });
        toast.success('Фон удален');
      } else {
        toast.error('Ошибка удаления фона');
      }
    } catch (error) {
      toast.error('Ошибка удаления фона');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDeleteClothing = async (clothingId: string) => {
    if (!confirm('Удалить этот элемент одежды?')) return;

    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const response = await fetch(`${CATALOG_API}?id=${clothingId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword || '' }
      });

      if (response.ok) {
        toast.success('Одежда удалена');
        fetchCatalogData();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  const toggleSelection = (array: number[], value: number) => {
    return array.includes(value)
      ? array.filter(v => v !== value)
      : [...array, value];
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
                <TabsList className="grid w-full md:w-auto grid-cols-4 mb-8">
                  <TabsTrigger value="users">Пользователи</TabsTrigger>
                  <TabsTrigger value="lookbooks">Лукбуки</TabsTrigger>
                  <TabsTrigger value="history">История</TabsTrigger>
                  <TabsTrigger value="catalog">Каталог</TabsTrigger>
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
                      <div className="flex justify-between items-center">
                        <CardTitle>История примерок</CardTitle>
                        <select
                          value={selectedHistoryUserId}
                          onChange={(e) => {
                            const userId = e.target.value;
                            setSelectedHistoryUserId(userId);
                            if (userId === 'all') {
                              setFilteredHistory(history);
                            } else {
                              setFilteredHistory(history.filter(h => h.user_id === userId));
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
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredHistory.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">История пуста</p>
                        ) : (
                          filteredHistory.map((item) => (
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

                <TabsContent value="catalog">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle>Каталог одежды</CardTitle>
                        <Button onClick={() => setShowAddClothing(!showAddClothing)}>
                          <Icon name="Plus" className="mr-2" size={18} />
                          Добавить одежду
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {showAddClothing && (
                        <div className="mb-6 p-4 border rounded-lg space-y-4 bg-muted/50">
                          <h3 className="font-medium">Новая одежда</h3>
                          
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Ссылка на изображение"
                                value={newClothing.image_url}
                                onChange={(e) => handleImageUrlInput(e.target.value)}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCropImage}
                                disabled={!newClothing.image_url}
                              >
                                <Icon name="Crop" className="mr-2" size={16} />
                                Кадрировать
                              </Button>
                            </div>
                            {newClothing.image_url && (
                              <img
                                src={newClothing.image_url}
                                alt="Preview"
                                className="w-32 h-32 object-cover rounded border"
                              />
                            )}
                          </div>
                          
                          <Input
                            placeholder="Название (необязательно)"
                            value={newClothing.name}
                            onChange={(e) => setNewClothing({ ...newClothing, name: e.target.value })}
                          />
                          
                          <Input
                            placeholder="Описание (необязательно)"
                            value={newClothing.description}
                            onChange={(e) => setNewClothing({ ...newClothing, description: e.target.value })}
                          />
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Категории:</p>
                            <div className="flex flex-wrap gap-2">
                              {filters?.categories.map((cat) => (
                                <Button
                                  key={cat.id}
                                  size="sm"
                                  variant={newClothing.category_ids.includes(cat.id) ? 'default' : 'outline'}
                                  onClick={() => setNewClothing({
                                    ...newClothing,
                                    category_ids: toggleSelection(newClothing.category_ids, cat.id)
                                  })}
                                >
                                  {cat.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Цвета:</p>
                            <div className="flex flex-wrap gap-2">
                              {filters?.colors.map((color) => (
                                <Button
                                  key={color.id}
                                  size="sm"
                                  variant={newClothing.color_ids.includes(color.id) ? 'default' : 'outline'}
                                  onClick={() => setNewClothing({
                                    ...newClothing,
                                    color_ids: toggleSelection(newClothing.color_ids, color.id)
                                  })}
                                >
                                  {color.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Архетипы Киббе:</p>
                            <div className="flex flex-wrap gap-2">
                              {filters?.archetypes.map((arch) => (
                                <Button
                                  key={arch.id}
                                  size="sm"
                                  variant={newClothing.archetype_ids.includes(arch.id) ? 'default' : 'outline'}
                                  onClick={() => setNewClothing({
                                    ...newClothing,
                                    archetype_ids: toggleSelection(newClothing.archetype_ids, arch.id)
                                  })}
                                >
                                  {arch.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button onClick={handleAddClothing}>Добавить</Button>
                            <Button variant="outline" onClick={() => setShowAddClothing(false)}>
                              Отмена
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {clothingItems.length === 0 ? (
                          <p className="col-span-full text-center text-muted-foreground py-8">
                            Каталог пуст
                          </p>
                        ) : (
                          clothingItems.map((item) => (
                            <Card key={item.id} className="overflow-hidden">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-48 object-cover"
                              />
                              <CardContent className="p-3 space-y-2">
                                {item.name && (
                                  <p className="font-medium text-sm">{item.name}</p>
                                )}
                                {item.categories.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.categories.map((cat, idx) => (
                                      <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {item.colors.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.colors.map((color, idx) => (
                                      <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        {color}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {item.archetypes.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.archetypes.map((arch, idx) => (
                                      <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                        {arch}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditClothing(item)}
                                  >
                                    <Icon name="Edit" size={14} className="mr-1" />
                                    Редактировать
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteClothing(item.id)}
                                  >
                                    <Icon name="Trash2" size={14} className="mr-1" />
                                    Удалить
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
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

      {editingClothing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Редактировать элемент</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditingClothing(null)}>
                <Icon name="X" size={20} />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <img src={editingClothing.image_url} alt="Preview" className="w-full h-64 object-cover rounded mb-2" />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCropEditingImage}
                  >
                    <Icon name="Crop" className="mr-2" size={16} />
                    Кадрировать
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleRemoveBackground}
                    disabled={isProcessingImage}
                  >
                    {isProcessingImage ? (
                      <>
                        <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                        Удаление фона...
                      </>
                    ) : (
                      <>
                        <Icon name="Scissors" className="mr-2" size={16} />
                        Удалить фон заново
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Ссылка на изображение</label>
                <Input
                  value={editingClothing.image_url}
                  onChange={(e) => setEditingClothing({ ...editingClothing, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Название</label>
                <Input
                  value={editingClothing.name}
                  onChange={(e) => setEditingClothing({ ...editingClothing, name: e.target.value })}
                  placeholder="Название элемента"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Описание</label>
                <Input
                  value={editingClothing.description}
                  onChange={(e) => setEditingClothing({ ...editingClothing, description: e.target.value })}
                  placeholder="Описание"
                />
              </div>

              {filters && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Категории</label>
                    <div className="flex flex-wrap gap-2">
                      {filters.categories.map((cat) => {
                        const isSelected = editingClothing.categories.includes(cat.name);
                        return (
                          <Button
                            key={cat.id}
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => {
                              if (isSelected) {
                                setEditingClothing({
                                  ...editingClothing,
                                  categories: editingClothing.categories.filter(c => c !== cat.name)
                                });
                              } else {
                                setEditingClothing({
                                  ...editingClothing,
                                  categories: [...editingClothing.categories, cat.name]
                                });
                              }
                            }}
                          >
                            {cat.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Цвета</label>
                    <div className="flex flex-wrap gap-2">
                      {filters.colors.map((color) => {
                        const isSelected = editingClothing.colors.includes(color.name);
                        return (
                          <Button
                            key={color.id}
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => {
                              if (isSelected) {
                                setEditingClothing({
                                  ...editingClothing,
                                  colors: editingClothing.colors.filter(c => c !== color.name)
                                });
                              } else {
                                setEditingClothing({
                                  ...editingClothing,
                                  colors: [...editingClothing.colors, color.name]
                                });
                              }
                            }}
                          >
                            {color.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Архетипы Киббе</label>
                    <div className="flex flex-wrap gap-2">
                      {filters.archetypes.map((arch) => {
                        const isSelected = editingClothing.archetypes.includes(arch.name);
                        return (
                          <Button
                            key={arch.id}
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => {
                              if (isSelected) {
                                setEditingClothing({
                                  ...editingClothing,
                                  archetypes: editingClothing.archetypes.filter(a => a !== arch.name)
                                });
                              } else {
                                setEditingClothing({
                                  ...editingClothing,
                                  archetypes: [...editingClothing.archetypes, arch.name]
                                });
                              }
                            }}
                          >
                            {arch.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingClothing(null)}>
                  Отмена
                </Button>
                <Button className="flex-1" onClick={handleUpdateClothing}>
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCropper && imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          open={showCropper}
          onClose={() => setShowCropper(false)}
          onCropComplete={handleCropComplete}
        />
      )}
    </Layout>
  );
}
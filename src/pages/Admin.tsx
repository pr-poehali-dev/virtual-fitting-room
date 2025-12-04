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
  balance?: number;
  free_tries_used?: number;
  unlimited_access?: boolean;
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



interface Stats {
  total_users: number;
  total_lookbooks: number;
  total_replicate: number;
  total_seedream: number;
  total_nanobana: number;
  today_replicate: number;
  today_seedream: number;
  today_nanobana: number;
  total_revenue: number;
  today_revenue: number;
  month_revenue: number;
  total_payments: number;
}

interface Payment {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  amount: number;
  payment_method: string;
  status: string;
  order_id: string;
  created_at: string;
  updated_at: string;
}

interface GenerationHistory {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  model_used: string;
  saved_to_lookbook: boolean;
  cost: number;
  photo_status: 'in_history' | 'in_lookbook' | 'removed';
  result_image: string;
  created_at: string;
}

interface CleanupLog {
  id: string;
  cleanup_type: string;
  removed_from_history: number;
  removed_from_s3: number;
  total_checked: number;
  error_message: string | null;
  created_at: string;
}

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  replicate_category?: string;
  gender?: string;
  created_at: string;
}

interface FilterOption {
  id: number | string;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
  genders: FilterOption[];
}

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';
const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';
const IMAGE_PREPROCESSING_API = 'https://functions.poehali.dev/3fe8c892-ab5f-4d26-a2c5-ae4166276334';
const ADMIN_MANAGE_ACCESS_API = 'https://functions.poehali.dev/15f28986-cce9-4e25-a05b-0860b1cf9cf7';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [filteredLookbooks, setFilteredLookbooks] = useState<Lookbook[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [showAddClothing, setShowAddClothing] = useState(false);
  const [selectedCatalogCategories, setSelectedCatalogCategories] = useState<number[]>([]);
  const [selectedCatalogColors, setSelectedCatalogColors] = useState<number[]>([]);
  const [selectedCatalogArchetypes, setSelectedCatalogArchetypes] = useState<number[]>([]);
  const [selectedCatalogGender, setSelectedCatalogGender] = useState<string>('');
  const [editingClothing, setEditingClothing] = useState<ClothingItem | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [newClothing, setNewClothing] = useState({
    image_url: '',
    name: '',
    description: '',
    category_ids: [] as number[],
    color_ids: [] as number[],
    archetype_ids: [] as number[],
    replicate_category: '' as string,
    gender: 'unisex' as string
  });
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [cropMode, setCropMode] = useState<'new' | 'edit'>('new');
  const [uploadSource, setUploadSource] = useState<'url' | 'file'>('url');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentDateFrom, setPaymentDateFrom] = useState<string>('');
  const [paymentDateTo, setPaymentDateTo] = useState<string>('');

  const [generationHistory, setGenerationHistory] = useState<GenerationHistory[]>([]);
  const [genUserFilter, setGenUserFilter] = useState<string>('all');
  const [genModelFilter, setGenModelFilter] = useState<string>('all');
  const [genSavedFilter, setGenSavedFilter] = useState<string>('all');
  const [genDateFrom, setGenDateFrom] = useState<string>('');
  const [genDateTo, setGenDateTo] = useState<string>('');

  const [cleanupLogs, setCleanupLogs] = useState<CleanupLog[]>([]);
  const [cleanupTypeFilter, setCleanupTypeFilter] = useState<string>('all');
  const [cleanupDateFrom, setCleanupDateFrom] = useState<string>('');
  const [cleanupDateTo, setCleanupDateTo] = useState<string>('');

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_auth');
    if (adminAuth) {
      setIsAuthenticated(true);
      fetchData();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCatalogData();
    }
  }, [selectedCatalogCategories, selectedCatalogColors, selectedCatalogArchetypes, selectedCatalogGender, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchGenerationHistory();
    }
  }, [genUserFilter, genModelFilter, genSavedFilter, genDateFrom, genDateTo, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCleanupLogs();
    }
  }, [cleanupTypeFilter, cleanupDateFrom, cleanupDateTo, isAuthenticated]);

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
      const params = new URLSearchParams({ action: 'list' });
      if (selectedCatalogCategories.length > 0) {
        params.append('categories', selectedCatalogCategories.join(','));
      }
      if (selectedCatalogColors.length > 0) {
        params.append('colors', selectedCatalogColors.join(','));
      }
      if (selectedCatalogArchetypes.length > 0) {
        params.append('archetypes', selectedCatalogArchetypes.join(','));
      }
      if (selectedCatalogGender) {
        params.append('gender', selectedCatalogGender);
      }

      const [filtersRes, catalogRes] = await Promise.all([
        fetch(`${CATALOG_API}?action=filters`),
        fetch(`${CATALOG_API}?${params.toString()}`)
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
      const [statsRes, usersRes, lookbooksRes, filtersRes, catalogRes, paymentsRes] = await Promise.all([
        fetch(`${ADMIN_API}?action=stats`, {
          headers: { 'X-Admin-Password': adminPassword || '' }
        }),
        fetch(`${ADMIN_API}?action=users`, {
          headers: { 'X-Admin-Password': adminPassword || '' }
        }),
        fetch(`${ADMIN_API}?action=lookbooks`, {
          headers: { 'X-Admin-Password': adminPassword || '' }
        }),
        fetch(`${CATALOG_API}?action=filters`),
        fetch(`${CATALOG_API}?action=list`),
        fetch(`${ADMIN_API}?action=payments`, {
          headers: { 'X-Admin-Password': adminPassword || '' }
        })
      ]);

      if (!statsRes.ok || !usersRes.ok || !lookbooksRes.ok || !filtersRes.ok || !catalogRes.ok || !paymentsRes.ok) {
        throw new Error('Ошибка загрузки данных');
      }

      const [statsData, usersData, lookbooksData, filtersData, catalogData, paymentsData] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
        lookbooksRes.json(),
        filtersRes.json(),
        catalogRes.json(),
        paymentsRes.json()
      ]);

      setStats(statsData);
      setUsers(usersData);
      setLookbooks(lookbooksData);
      setFilteredLookbooks(lookbooksData);
      setFilters(filtersData);
      setClothingItems(catalogData);
      setPayments(paymentsData);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGenerationHistory = async () => {
    const adminPassword = sessionStorage.getItem('admin_auth');
    const params = new URLSearchParams({ action: 'generation_history' });
    
    if (genUserFilter && genUserFilter !== 'all') params.append('user_id', genUserFilter);
    if (genModelFilter && genModelFilter !== 'all') params.append('model', genModelFilter);
    if (genSavedFilter && genSavedFilter !== 'all') params.append('saved_to_lookbook', genSavedFilter);
    if (genDateFrom) params.append('date_from', genDateFrom);
    if (genDateTo) params.append('date_to', genDateTo);

    try {
      const response = await fetch(`${ADMIN_API}?${params.toString()}`, {
        headers: { 'X-Admin-Password': adminPassword || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setGenerationHistory(data);
      } else {
        toast.error('Ошибка загрузки истории генераций');
      }
    } catch (error) {
      toast.error('Ошибка загрузки истории генераций');
    }
  };

  const fetchCleanupLogs = async () => {
    const adminPassword = sessionStorage.getItem('admin_auth');
    const params = new URLSearchParams({ action: 'cleanup_logs' });
    
    if (cleanupTypeFilter && cleanupTypeFilter !== 'all') params.append('cleanup_type', cleanupTypeFilter);
    if (cleanupDateFrom) params.append('date_from', cleanupDateFrom);
    if (cleanupDateTo) params.append('date_to', cleanupDateTo);

    try {
      const response = await fetch(`${ADMIN_API}?${params.toString()}`, {
        headers: { 'X-Admin-Password': adminPassword || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setCleanupLogs(data);
      } else {
        toast.error('Ошибка загрузки логов очистки');
      }
    } catch (error) {
      toast.error('Ошибка загрузки логов очистки');
    }
  };

  const handleToggleUnlimitedAccess = async (userEmail: string, currentAccess: boolean) => {
    const adminPassword = sessionStorage.getItem('admin_auth');
    const newAccess = !currentAccess;

    try {
      const response = await fetch(ADMIN_MANAGE_ACCESS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword || ''
        },
        body: JSON.stringify({
          user_email: userEmail,
          unlimited_access: newAccess
        })
      });

      if (response.ok) {
        toast.success(newAccess ? 'Безлимитный доступ предоставлен' : 'Безлимитный доступ отключён');
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Ошибка обновления доступа');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
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
        const data = await response.json();
        toast.error(`Ошибка удаления: ${data.error || 'неизвестная ошибка'}`);
        console.error('Delete user error:', data);
      }
    } catch (error) {
      toast.error(`Ошибка удаления: ${error}`);
      console.error('Delete user exception:', error);
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
        // Обновляем список лукбуков сразу после удаления
        setLookbooks(prev => prev.filter(lb => lb.id !== lookbookId));
        setFilteredLookbooks(prev => prev.filter(lb => lb.id !== lookbookId));
        
        // Также делаем fetch для синхронизации с сервером
        fetchData();
        
        toast.success('Лукбук удален');
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Image = reader.result as string;
      setNewClothing(prev => ({ ...prev, image_url: base64Image }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = async () => {
    if (!newClothing.image_url) {
      toast.error('Сначала загрузите изображение');
      return;
    }

    setIsProcessingImage(true);
    try {
      const response = await fetch(IMAGE_PREPROCESSING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: newClothing.image_url })
      });

      if (!response.ok) throw new Error('Failed to remove background');
      
      const data = await response.json();
      setNewClothing(prev => ({ ...prev, image_url: data.processed_image }));
      toast.success('Фон удалён');
    } catch (error) {
      toast.error('Ошибка удаления фона');
    } finally {
      setIsProcessingImage(false);
    }
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
          archetype_ids: [],
          replicate_category: '',
          gender: 'unisex'
        });
        setUploadSource('url');
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
          archetype_ids: archetypeIds,
          replicate_category: editingClothing.replicate_category || 'upper_body',
          gender: editingClothing.gender || 'unisex'
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

  const handleRemoveBackgroundEdit = async () => {
    if (!editingClothing?.image_url) {
      toast.error('Нет изображения');
      return;
    }

    setIsProcessingImage(true);
    try {
      const response = await fetch(IMAGE_PREPROCESSING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: editingClothing.image_url })
      });

      if (!response.ok) throw new Error('Failed to remove background');
      
      const data = await response.json();
      setEditingClothing({ ...editingClothing, image_url: data.processed_image });
      toast.success('Фон удалён');
    } catch (error) {
      toast.error('Ошибка удаления фона');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleCropImageEdit = () => {
    if (!editingClothing?.image_url) {
      toast.error('Нет изображения');
      return;
    }
    setImageToCrop(editingClothing.image_url);
    setCropMode('edit');
    setShowCropper(true);
  };

  const handleFileUploadEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingClothing) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Image = reader.result as string;
      setEditingClothing({ ...editingClothing, image_url: base64Image });
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteClothing = async (clothingId: string) => {
    if (!confirm('Удалить этот элемент одежды из каталога?\n\nФото также будет удалено из облачного хранилища.')) return;

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
              <div className="grid md:grid-cols-2 gap-6 mb-8">
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
                      Примерочная 1 (Replicate)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="Shirt" size={24} className="text-blue-600" />
                      <div>
                        <div className="text-2xl font-bold">{stats?.total_replicate || 0}</div>
                        <div className="text-xs text-muted-foreground">Сегодня: {stats?.today_replicate || 0}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Примерочная 2 (SeeDream)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="Sparkles" size={24} className="text-purple-600" />
                      <div>
                        <div className="text-2xl font-bold">{stats?.total_seedream || 0}</div>
                        <div className="text-xs text-muted-foreground">Сегодня: {stats?.today_seedream || 0}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Примерочная 3 (NanoBanana)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="Zap" size={24} className="text-orange-600" />
                      <div>
                        <div className="text-2xl font-bold">{stats?.total_nanobana || 0}</div>
                        <div className="text-xs text-muted-foreground">Сегодня: {stats?.today_nanobana || 0}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Доход всего
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="Coins" size={24} className="text-green-600" />
                      <span className="text-3xl font-bold">{stats?.total_revenue.toFixed(0) || 0} ₽</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Платежей: {stats?.total_payments || 0}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Доход за месяц
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="TrendingUp" size={24} className="text-blue-600" />
                      <span className="text-3xl font-bold">{stats?.month_revenue.toFixed(0) || 0} ₽</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Последние 30 дней
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Доход сегодня
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="Wallet" size={24} className="text-orange-600" />
                      <span className="text-3xl font-bold">{stats?.today_revenue.toFixed(0) || 0} ₽</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      За текущий день
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Средний чек
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Icon name="CreditCard" size={24} className="text-purple-600" />
                      <span className="text-3xl font-bold">
                        {stats?.total_payments ? (stats.total_revenue / stats.total_payments).toFixed(0) : 0} ₽
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      На транзакцию
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full md:w-auto grid-cols-6 mb-8">
                  <TabsTrigger value="users">Пользователи</TabsTrigger>
                  <TabsTrigger value="lookbooks">Лукбуки</TabsTrigger>
                  <TabsTrigger value="payments">Платежи</TabsTrigger>
                  <TabsTrigger value="catalog">Каталог</TabsTrigger>
                  <TabsTrigger value="generations">Генерации</TabsTrigger>
                  <TabsTrigger value="cleanup">Очистка</TabsTrigger>
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
                              className="p-4 border rounded-lg space-y-3"
                            >
                              <div className="flex items-center justify-between">
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
                              
                              <div className="flex items-center gap-4 pt-2 border-t">
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground">Баланс</p>
                                  <p className="font-medium">{user.balance?.toFixed(2) || '0.00'} ₽</p>
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground">Бесплатных</p>
                                  <p className="font-medium">{3 - (user.free_tries_used || 0)} / 3</p>
                                </div>
                                <div className="flex-1">
                                  {user.unlimited_access ? (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <Icon name="Infinity" size={16} />
                                      <span className="text-sm font-medium">Безлимит</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Обычный</span>
                                  )}
                                </div>
                                <Button
                                  variant={user.unlimited_access ? "outline" : "default"}
                                  size="sm"
                                  onClick={() => handleToggleUnlimitedAccess(user.email, user.unlimited_access || false)}
                                >
                                  {user.unlimited_access ? (
                                    <>
                                      <Icon name="X" className="mr-1" size={14} />
                                      Отключить
                                    </>
                                  ) : (
                                    <>
                                      <Icon name="Infinity" className="mr-1" size={14} />
                                      Безлимит
                                    </>
                                  )}
                                </Button>
                              </div>
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
                      {filters && (
                        <div className="mb-6 space-y-3 p-4 bg-muted/30 rounded-lg">
                          <div>
                            <p className="text-sm font-medium mb-2">Фильтр по категории:</p>
                            <div className="flex flex-wrap gap-2">
                              {filters.categories.map((category) => (
                                <Button
                                  key={category.id}
                                  size="sm"
                                  variant={selectedCatalogCategories.includes(category.id) ? 'default' : 'outline'}
                                  onClick={() => setSelectedCatalogCategories(
                                    selectedCatalogCategories.includes(category.id)
                                      ? selectedCatalogCategories.filter(v => v !== category.id)
                                      : [...selectedCatalogCategories, category.id]
                                  )}
                                >
                                  {category.name}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Фильтр по цвету:</p>
                            <div className="flex flex-wrap gap-2">
                              {filters.colors.map((color) => (
                                <Button
                                  key={color.id}
                                  size="sm"
                                  variant={selectedCatalogColors.includes(color.id) ? 'default' : 'outline'}
                                  onClick={() => setSelectedCatalogColors(
                                    selectedCatalogColors.includes(color.id)
                                      ? selectedCatalogColors.filter(v => v !== color.id)
                                      : [...selectedCatalogColors, color.id]
                                  )}
                                >
                                  {color.name}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Фильтр по архетипу:</p>
                            <div className="flex flex-wrap gap-2">
                              {filters.archetypes.map((arch) => (
                                <Button
                                  key={arch.id}
                                  size="sm"
                                  variant={selectedCatalogArchetypes.includes(arch.id) ? 'default' : 'outline'}
                                  onClick={() => setSelectedCatalogArchetypes(
                                    selectedCatalogArchetypes.includes(arch.id)
                                      ? selectedCatalogArchetypes.filter(v => v !== arch.id)
                                      : [...selectedCatalogArchetypes, arch.id]
                                  )}
                                >
                                  {arch.name}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Фильтр по полу:</p>
                            <div className="flex flex-wrap gap-2">
                              {filters.genders.map((gender) => (
                                <Button
                                  key={gender.id}
                                  size="sm"
                                  variant={selectedCatalogGender === gender.id ? 'default' : 'outline'}
                                  onClick={() => setSelectedCatalogGender(selectedCatalogGender === gender.id ? '' : gender.id as string)}
                                >
                                  {gender.name}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {(selectedCatalogCategories.length > 0 || selectedCatalogColors.length > 0 || selectedCatalogArchetypes.length > 0 || selectedCatalogGender) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCatalogCategories([]);
                                setSelectedCatalogColors([]);
                                setSelectedCatalogArchetypes([]);
                                setSelectedCatalogGender('');
                              }}
                            >
                              <Icon name="X" className="mr-2" size={16} />
                              Сбросить фильтры
                            </Button>
                          )}
                        </div>
                      )}
                      {showAddClothing && (
                        <div className="mb-6 p-4 border rounded-lg space-y-4 bg-muted/50">
                          <h3 className="font-medium">Новая одежда</h3>
                          
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={uploadSource === 'url' ? 'default' : 'outline'}
                                onClick={() => setUploadSource('url')}
                              >
                                <Icon name="Link" className="mr-2" size={16} />
                                По ссылке
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={uploadSource === 'file' ? 'default' : 'outline'}
                                onClick={() => setUploadSource('file')}
                              >
                                <Icon name="Upload" className="mr-2" size={16} />
                                С компьютера
                              </Button>
                            </div>
                            
                            {uploadSource === 'url' ? (
                              <Input
                                placeholder="https://example.com/image.jpg"
                                value={newClothing.image_url}
                                onChange={(e) => setNewClothing({ ...newClothing, image_url: e.target.value })}
                              />
                            ) : (
                              <div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFileUpload}
                                  className="hidden"
                                  id="file-upload-admin"
                                />
                                <label htmlFor="file-upload-admin">
                                  <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors">
                                    <Icon name="Upload" className="mx-auto mb-2 text-muted-foreground" size={32} />
                                    <p className="text-sm text-muted-foreground">Нажмите для загрузки</p>
                                  </div>
                                </label>
                              </div>
                            )}
                            
                            {newClothing.image_url && (
                              <div className="space-y-2">
                                <img
                                  src={newClothing.image_url}
                                  alt="Preview"
                                  className="w-full h-48 object-contain rounded border bg-muted"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleRemoveBackground}
                                    disabled={isProcessingImage}
                                  >
                                    {isProcessingImage ? (
                                      <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                                    ) : (
                                      <Icon name="Eraser" className="mr-2" size={16} />
                                    )}
                                    Удалить фон
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCropImage}
                                  >
                                    <Icon name="Crop" className="mr-2" size={16} />
                                    Обрезать
                                  </Button>
                                </div>
                              </div>
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
                              {filters?.categories.map((category) => (
                                <Button
                                  key={category.id}
                                  size="sm"
                                  variant={newClothing.category_ids.includes(category.id) ? 'default' : 'outline'}
                                  onClick={() => {
                                    const newCategoryIds = toggleSelection(newClothing.category_ids, category.id);
                                    const hasRestrictedCategory = newCategoryIds.some(id => {
                                      const cat = filters?.categories.find(c => c.id === id);
                                      return cat && ['Обувь', 'Аксессуары', 'Головные уборы'].includes(cat.name);
                                    });
                                    setNewClothing({
                                      ...newClothing,
                                      category_ids: newCategoryIds,
                                      replicate_category: hasRestrictedCategory ? '' : newClothing.replicate_category
                                    });
                                  }}
                                >
                                  {category.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Категория для Replicate (для примерочной):</p>
                            <select
                              value={newClothing.replicate_category}
                              onChange={(e) => setNewClothing({ ...newClothing, replicate_category: e.target.value })}
                              className="w-full border rounded-md px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={newClothing.category_ids.some(id => {
                                const category = filters?.categories.find(c => c.id === id);
                                return category && ['Обувь', 'Аксессуары', 'Головные уборы'].includes(category.name);
                              })}
                            >
                              <option value="">Не выбрано</option>
                              <option value="upper_body">Верх (Топы, Рубашки, Жакеты)</option>
                              <option value="lower_body">Низ (Брюки, Юбки, Шорты)</option>
                              <option value="dresses">Весь образ, платья, верх и низ вместе</option>
                            </select>
                            {newClothing.category_ids.some(id => {
                              const category = filters?.categories.find(c => c.id === id);
                              return category && ['Обувь', 'Аксессуары', 'Головные уборы'].includes(category.name);
                            }) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Категория Replicate недоступна для обуви, аксессуаров и головных уборов
                              </p>
                            )}
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium mb-2">Пол:</p>
                            <select
                              value={newClothing.gender}
                              onChange={(e) => setNewClothing({ ...newClothing, gender: e.target.value })}
                              className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                              <option value="unisex">Унисекс</option>
                              <option value="male">Мужской</option>
                              <option value="female">Женский</option>
                            </select>
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
                                className="w-full h-48 object-contain bg-muted"
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
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditClothing(item)}
                                    className="flex-1"
                                  >
                                    <Icon name="Edit" size={16} />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteClothing(item.id)}
                                    className="flex-1"
                                  >
                                    <Icon name="Trash2" size={16} />
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

                <TabsContent value="payments">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon name="CreditCard" size={24} />
                        Платежи пользователей
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6 flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Статус:</label>
                          <select
                            className="border rounded-md px-3 py-2"
                            value={paymentStatusFilter}
                            onChange={(e) => setPaymentStatusFilter(e.target.value)}
                          >
                            <option value="all">Все</option>
                            <option value="completed">Завершены</option>
                            <option value="pending">Ожидание</option>
                            <option value="failed">Ошибка</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">С:</label>
                          <Input
                            type="date"
                            value={paymentDateFrom}
                            onChange={(e) => setPaymentDateFrom(e.target.value)}
                            className="w-40"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">До:</label>
                          <Input
                            type="date"
                            value={paymentDateTo}
                            onChange={(e) => setPaymentDateTo(e.target.value)}
                            className="w-40"
                          />
                        </div>
                        <Button
                          onClick={() => {
                            const filtered = payments.filter(p => {
                              if (paymentStatusFilter !== 'all' && p.status !== paymentStatusFilter) return false;
                              if (paymentDateFrom && new Date(p.created_at) < new Date(paymentDateFrom)) return false;
                              if (paymentDateTo && new Date(p.created_at) > new Date(paymentDateTo + 'T23:59:59')) return false;
                              return true;
                            });
                            
                            const csv = [
                              ['ID', 'Email', 'Имя', 'Сумма', 'Метод', 'Статус', 'Order ID', 'Создан', 'Обновлен'].join(','),
                              ...filtered.map(p => [
                                p.id,
                                p.user_email,
                                p.user_name,
                                p.amount,
                                p.payment_method,
                                p.status,
                                p.order_id,
                                new Date(p.created_at).toLocaleString('ru-RU'),
                                p.updated_at ? new Date(p.updated_at).toLocaleString('ru-RU') : ''
                              ].join(','))
                            ].join('\n');
                            
                            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            link.download = `payments_${new Date().toISOString().split('T')[0]}.csv`;
                            link.click();
                            toast.success('CSV экспортирован');
                          }}
                          variant="outline"
                        >
                          <Icon name="Download" className="mr-2" size={16} />
                          Экспорт в CSV
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {payments
                          .filter(p => {
                            if (paymentStatusFilter !== 'all' && p.status !== paymentStatusFilter) return false;
                            if (paymentDateFrom && new Date(p.created_at) < new Date(paymentDateFrom)) return false;
                            if (paymentDateTo && new Date(p.created_at) > new Date(paymentDateTo + 'T23:59:59')) return false;
                            return true;
                          })
                          .map((payment) => (
                            <div key={payment.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                              <div className="grid md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Пользователь</p>
                                  <p className="font-medium">{payment.user_email}</p>
                                  <p className="text-sm text-muted-foreground">{payment.user_name}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Сумма</p>
                                  <p className="text-2xl font-light">{payment.amount.toFixed(2)} ₽</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Статус</p>
                                  <div className="flex items-center gap-2">
                                    {payment.status === 'completed' && (
                                      <span className="inline-flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                                        <Icon name="CheckCircle2" size={14} />
                                        Завершен
                                      </span>
                                    )}
                                    {payment.status === 'pending' && (
                                      <span className="inline-flex items-center gap-1 text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                                        <Icon name="Clock" size={14} />
                                        Ожидание
                                      </span>
                                    )}
                                    {payment.status === 'failed' && (
                                      <span className="inline-flex items-center gap-1 text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full">
                                        <Icon name="XCircle" size={14} />
                                        Ошибка
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground mb-1">Дата</p>
                                  <p className="text-sm">
                                    {new Date(payment.created_at).toLocaleDateString('ru-RU', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Order: {payment.order_id}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        }
                        {payments.filter(p => {
                          if (paymentStatusFilter !== 'all' && p.status !== paymentStatusFilter) return false;
                          if (paymentDateFrom && new Date(p.created_at) < new Date(paymentDateFrom)) return false;
                          if (paymentDateTo && new Date(p.created_at) > new Date(paymentDateTo + 'T23:59:59')) return false;
                          return true;
                        }).length === 0 && (
                          <div className="text-center py-12 text-muted-foreground">
                            <Icon name="CreditCard" size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Нет платежей по выбранным фильтрам</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="generations">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Icon name="Sparkles" size={24} />
                          История генераций
                        </CardTitle>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={async () => {
                            if (!confirm('Удалить ВСЕ записи из истории генераций?\n\nЭто действие необратимо!')) return;
                            
                            const adminPassword = sessionStorage.getItem('admin_auth');
                            try {
                              const response = await fetch(`${ADMIN_API}?action=clear_generation_history`, {
                                method: 'DELETE',
                                headers: { 'X-Admin-Password': adminPassword || '' }
                              });
                              
                              if (response.ok) {
                                toast.success('История генераций очищена');
                                fetchGenerationHistory();
                                
                                const statsRes = await fetch(`${ADMIN_API}?action=stats`, {
                                  headers: { 'X-Admin-Password': adminPassword || '' }
                                });
                                if (statsRes.ok) {
                                  const statsData = await statsRes.json();
                                  setStats(statsData);
                                }
                              } else {
                                toast.error('Ошибка очистки');
                              }
                            } catch (error) {
                              toast.error('Ошибка очистки');
                            }
                          }}
                        >
                          <Icon name="Trash2" size={16} className="mr-2" />
                          Очистить всё
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6 flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Пользователь:</label>
                          <select
                            className="border rounded-md px-3 py-2"
                            value={genUserFilter}
                            onChange={(e) => setGenUserFilter(e.target.value)}
                          >
                            <option value="all">Все</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.email}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Модель:</label>
                          <select
                            className="border rounded-md px-3 py-2"
                            value={genModelFilter}
                            onChange={(e) => setGenModelFilter(e.target.value)}
                          >
                            <option value="all">Все</option>
                            <option value="replicate">Replicate</option>
                            <option value="seedream">SeeDream</option>
                            <option value="nanobananapro">NanoBanana</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Сохранено:</label>
                          <select
                            className="border rounded-md px-3 py-2"
                            value={genSavedFilter}
                            onChange={(e) => setGenSavedFilter(e.target.value)}
                          >
                            <option value="all">Все</option>
                            <option value="true">Да</option>
                            <option value="false">Нет</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">С:</label>
                          <Input
                            type="date"
                            value={genDateFrom}
                            onChange={(e) => setGenDateFrom(e.target.value)}
                            className="w-40"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">До:</label>
                          <Input
                            type="date"
                            value={genDateTo}
                            onChange={(e) => setGenDateTo(e.target.value)}
                            className="w-40"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {generationHistory.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <Icon name="Sparkles" size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Нет генераций</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-2">Пользователь</th>
                                  <th className="text-left p-2">ID</th>
                                  <th className="text-left p-2">Модель</th>
                                  <th className="text-left p-2">Статус фото</th>
                                  <th className="text-left p-2">Стоимость</th>
                                  <th className="text-left p-2">Дата</th>
                                  <th className="text-left p-2">Превью</th>
                                </tr>
                              </thead>
                              <tbody>
                                {generationHistory.map(gen => (
                                  <tr key={gen.id} className="border-b hover:bg-muted/50">
                                    <td className="p-2">
                                      <div>
                                        <div className="font-medium text-xs">{gen.user_email}</div>
                                        <div className="text-xs text-muted-foreground">{gen.user_name}</div>
                                      </div>
                                    </td>
                                    <td className="p-2 text-xs font-mono">{gen.id.slice(0, 8)}...</td>
                                    <td className="p-2">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                                        {gen.model_used || 'unknown'}
                                      </span>
                                    </td>
                                    <td className="p-2">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          {gen.photo_status === 'in_lookbook' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                                              В лукбуке
                                            </span>
                                          )}
                                          {gen.photo_status === 'in_history' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                                              В истории
                                            </span>
                                          )}
                                          {gen.photo_status === 'removed' && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                                              Удалено
                                            </span>
                                          )}
                                        </div>
                                        {gen.saved_to_lookbook && (
                                          <div className="flex items-center gap-1 text-xs text-green-600">
                                            <Icon name="Check" size={12} />
                                            <span>Сохранено в лукбук</span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2 text-xs">{gen.cost} ₽</td>
                                    <td className="p-2 text-xs">
                                      {new Date(gen.created_at).toLocaleDateString('ru-RU', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </td>
                                    <td className="p-2">
                                      <img 
                                        src={gen.result_image} 
                                        alt="Result" 
                                        className="w-12 h-12 object-cover rounded cursor-pointer hover:scale-150 transition-transform"
                                        onClick={() => window.open(gen.result_image, '_blank')}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cleanup">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Icon name="Trash2" size={24} />
                        Журнал очистки
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-6 flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Тип:</label>
                          <select
                            className="border rounded-md px-3 py-2"
                            value={cleanupTypeFilter}
                            onChange={(e) => setCleanupTypeFilter(e.target.value)}
                          >
                            <option value="all">Все</option>
                            <option value="auto_6months">Авто (6 месяцев)</option>
                            <option value="manual">Ручная</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">С:</label>
                          <Input
                            type="date"
                            value={cleanupDateFrom}
                            onChange={(e) => setCleanupDateFrom(e.target.value)}
                            className="w-40"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">До:</label>
                          <Input
                            type="date"
                            value={cleanupDateTo}
                            onChange={(e) => setCleanupDateTo(e.target.value)}
                            className="w-40"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        {cleanupLogs.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <Icon name="Trash2" size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Нет записей очистки</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-2">Дата</th>
                                  <th className="text-left p-2">Тип</th>
                                  <th className="text-right p-2">Проверено</th>
                                  <th className="text-right p-2">Из истории</th>
                                  <th className="text-right p-2">Из S3</th>
                                  <th className="text-left p-2">Ошибка</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cleanupLogs.map(log => (
                                  <tr key={log.id} className="border-b hover:bg-muted/50">
                                    <td className="p-2 text-xs">
                                      {new Date(log.created_at).toLocaleDateString('ru-RU', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </td>
                                    <td className="p-2">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                                        {log.cleanup_type === 'auto_6months' ? 'Авто (6 мес)' : log.cleanup_type}
                                      </span>
                                    </td>
                                    <td className="p-2 text-right font-medium">{log.total_checked}</td>
                                    <td className="p-2 text-right text-red-600 font-medium">{log.removed_from_history}</td>
                                    <td className="p-2 text-right text-red-600 font-medium">{log.removed_from_s3}</td>
                                    <td className="p-2 text-xs text-red-600">
                                      {log.error_message ? (
                                        <span title={log.error_message}>
                                          {log.error_message.slice(0, 50)}{log.error_message.length > 50 ? '...' : ''}
                                        </span>
                                      ) : (
                                        <span className="text-green-600">✓ Успешно</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
                <label className="text-sm font-medium mb-2 block">Изображение</label>
                <img src={editingClothing.image_url} alt="Preview" className="w-full h-64 object-contain rounded mb-3 bg-muted border" />
                <Input
                  value={editingClothing.image_url}
                  onChange={(e) => setEditingClothing({ ...editingClothing, image_url: e.target.value })}
                  placeholder="https://..."
                  className="text-xs"
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
                      {filters.categories.map((category) => {
                        const isSelected = editingClothing.categories.includes(category.name);
                        return (
                          <Button
                            key={category.id}
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => {
                              let newCategories;
                              if (isSelected) {
                                newCategories = editingClothing.categories.filter(c => c !== category.name);
                              } else {
                                newCategories = [...editingClothing.categories, category.name];
                              }
                              const hasRestrictedCategory = newCategories.some(cat => ['Обувь', 'Аксессуары', 'Головные уборы'].includes(cat));
                              setEditingClothing({
                                ...editingClothing,
                                categories: newCategories,
                                replicate_category: hasRestrictedCategory ? '' : editingClothing.replicate_category
                              });
                            }}
                          >
                            {category.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Категория для Replicate (для примерочной)</label>
                    <select
                      value={editingClothing.replicate_category || ''}
                      onChange={(e) => setEditingClothing({ ...editingClothing, replicate_category: e.target.value })}
                      className="w-full border rounded-md px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={editingClothing.categories.some(cat => ['Обувь', 'Аксессуары', 'Головные уборы'].includes(cat))}
                    >
                      <option value="">Не выбрано</option>
                      <option value="upper_body">Верх (Топы, Рубашки, Жакеты)</option>
                      <option value="lower_body">Низ (Брюки, Юбки, Шорты)</option>
                      <option value="dresses">Весь образ, платья, верх и низ вместе</option>
                    </select>
                    {editingClothing.categories.some(cat => ['Обувь', 'Аксессуары', 'Головные уборы'].includes(cat)) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Категория Replicate недоступна для обуви, аксессуаров и головных уборов
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Пол</label>
                    <select
                      value={editingClothing.gender || 'unisex'}
                      onChange={(e) => setEditingClothing({ ...editingClothing, gender: e.target.value })}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="unisex">Унисекс</option>
                      <option value="male">Мужской</option>
                      <option value="female">Женский</option>
                    </select>
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
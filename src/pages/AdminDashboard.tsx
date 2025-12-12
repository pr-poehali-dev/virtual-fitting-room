import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';

interface Stats {
  total_users: number;
  total_lookbooks: number;
  total_replicate: number;
  total_seedream: number;
  total_nanobana: number;
  today_replicate: number;
  today_seedream: number;
  today_nanobana: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const adminToken = localStorage.getItem('admin_jwt');
    const tokenExpiry = localStorage.getItem('admin_jwt_expiry');

    if (adminToken && tokenExpiry) {
      const expiryTime = new Date(tokenExpiry).getTime();
      if (Date.now() < expiryTime) {
        setIsAuthenticated(true);
        fetchStats();
      } else {
        localStorage.removeItem('admin_jwt');
        localStorage.removeItem('admin_jwt_expiry');
      }
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
        fetchStats();
      } else {
        toast.error('Неверный пароль');
      }
    } catch (error) {
      toast.error('Ошибка входа');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_jwt');
    localStorage.removeItem('admin_jwt_expiry');
    setIsAuthenticated(false);
    setPassword('');
    navigate('/');
  };

  const fetchStats = async () => {
    setIsLoading(true);
    const adminToken = localStorage.getItem('admin_jwt');

    try {
      const response = await fetch(`${ADMIN_API}?action=stats`, {
        headers: { 'X-Admin-Token': adminToken || '' }
      });

      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      toast.error('Ошибка загрузки статистики');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Админ-панель</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                <div>
                  <Input
                    type="password"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full mt-4">
                  Войти
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const dashboardCards = [
    {
      title: 'Статистика',
      description: 'Общая статистика платформы',
      icon: 'BarChart3',
      path: '/admin/stats',
      color: 'bg-indigo-100 text-indigo-700',
      value: '-'
    },
    {
      title: 'Пользователи',
      description: 'Управление пользователями',
      icon: 'Users',
      path: '/admin/users',
      color: 'bg-blue-100 text-blue-700',
      value: stats?.total_users || 0
    },
    {
      title: 'Лукбуки',
      description: 'Просмотр всех лукбуков',
      icon: 'Album',
      path: '/admin/lookbooks',
      color: 'bg-purple-100 text-purple-700',
      value: stats?.total_lookbooks || 0
    },
    {
      title: 'Платежи',
      description: 'История платежей',
      icon: 'CreditCard',
      path: '/admin/payments',
      color: 'bg-green-100 text-green-700',
      value: '-'
    },
    {
      title: 'Каталог',
      description: 'Управление каталогом одежды',
      icon: 'Package',
      path: '/admin/catalog',
      color: 'bg-orange-100 text-orange-700',
      value: '-'
    },
    {
      title: 'Генерации',
      description: 'История генераций',
      icon: 'Sparkles',
      path: '/admin/generations',
      color: 'bg-pink-100 text-pink-700',
      value: `${(stats?.total_replicate || 0) + (stats?.total_seedream || 0) + (stats?.total_nanobana || 0)}`
    }
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />
          
          <div className="flex-1">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold mb-2">Админ-панель</h1>
                <p className="text-muted-foreground">Управление платформой</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <Icon name="LogOut" size={16} className="mr-2" />
                Выйти
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" className="animate-spin" size={48} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardCards.map((card) => (
                  <Link key={card.path} to={card.path}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                      <CardHeader>
                        <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4`}>
                          <Icon name={card.icon} size={24} />
                        </div>
                        <CardTitle>{card.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground text-sm mb-3">{card.description}</p>
                        <p className="text-2xl font-bold">{card.value}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
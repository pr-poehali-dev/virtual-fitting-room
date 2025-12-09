import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';
const ADMIN_MANAGE_ACCESS_API = 'https://functions.poehali.dev/15f28986-cce9-4e25-a05b-0860b1cf9cf7';

interface User {
  id: string;
  email: string;
  name: string;
  balance?: number;
  free_tries_used?: number;
  unlimited_access?: boolean;
  created_at: string;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_auth');
    if (!adminAuth) {
      navigate('/admin');
      return;
    }
    fetchUsers();
  }, [navigate]);

  const fetchUsers = async () => {
    const adminPassword = sessionStorage.getItem('admin_auth');
    setIsLoading(true);

    try {
      const response = await fetch(`${ADMIN_API}?action=users`, {
        headers: { 'X-Admin-Password': adminPassword || '' }
      });

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast.error('Ошибка загрузки пользователей');
    } finally {
      setIsLoading(false);
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
        await fetchUsers();
      } else {
        toast.error('Ошибка изменения доступа');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
    }
  };

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
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Пользователи</h1>
              <p className="text-muted-foreground">Всего пользователей: {users.length}</p>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Имя</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Баланс</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Попыток</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Безлимит</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Регистрация</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{user.email}</td>
                          <td className="px-4 py-3 text-sm">{user.name}</td>
                          <td className="px-4 py-3 text-sm">{user.balance?.toFixed(2)} ₽</td>
                          <td className="px-4 py-3 text-sm">{user.free_tries_used || 0} / 3</td>
                          <td className="px-4 py-3">
                            {user.unlimited_access ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                <Icon name="Check" size={12} />
                                Да
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">Нет</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant={user.unlimited_access ? "outline" : "default"}
                              onClick={() => handleToggleUnlimitedAccess(user.email, user.unlimited_access || false)}
                            >
                              {user.unlimited_access ? 'Отключить безлимит' : 'Включить безлимит'}
                            </Button>
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
    </Layout>
  );
}
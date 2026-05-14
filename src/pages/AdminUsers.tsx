import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';
const ADMIN_MANAGE_ACCESS_API = 'https://functions.poehali.dev/15f28986-cce9-4e25-a05b-0860b1cf9cf7';
const ADMIN_SEND_EMAIL_API = 'https://functions.poehali.dev/40705a9e-619c-4d94-9aa9-cea003516795';
const getAdminToken = () => document.cookie.split('; ').find(c => c.startsWith('admin_token='))?.split('=')[1] || '';

type EmailTemplateKey = 'refund' | 'maintenance' | 'thanks' | 'custom';

const EMAIL_TEMPLATES: Record<EmailTemplateKey, { label: string; subject: string; body: (name: string) => string }> = {
  refund: {
    label: 'Возврат средств за технический сбой',
    subject: 'Возврат средств на ваш баланс',
    body: (name) => `Здравствуйте, ${name || 'пользователь'}!

Мы вернули вам {сумма}₽ на баланс в Виртуальной примерочной. Это компенсация за технические сбои на стороне сервиса, из-за которых несколько ваших запросов не завершились корректно.

Приносим извинения за неудобства. Если возникнут вопросы — напишите нам в поддержку.`,
  },
  maintenance: {
    label: 'Технические работы',
    subject: 'Технические работы на сервисе',
    body: (name) => `Здравствуйте, ${name || 'пользователь'}!

Сообщаем, что на сервисе Виртуальной примерочной проводятся технические работы. Возможны кратковременные перебои в работе. Мы стараемся завершить их как можно быстрее.

Спасибо за понимание!`,
  },
  thanks: {
    label: 'Благодарность',
    subject: 'Спасибо, что вы с нами!',
    body: (name) => `Здравствуйте, ${name || 'пользователь'}!

Спасибо, что пользуетесь Виртуальной примерочной! Мы рады, что вы с нами.

Если есть пожелания или идеи, как сделать сервис лучше — будем рады услышать.`,
  },
  custom: {
    label: 'Свой текст',
    subject: '',
    body: () => '',
  },
};

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const usersPerPage = 50;

  const [emailDialogUser, setEmailDialogUser] = useState<User | null>(null);
  const [emailTemplateKey, setEmailTemplateKey] = useState<EmailTemplateKey>('refund');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const openEmailDialog = (user: User) => {
    const tpl = EMAIL_TEMPLATES.refund;
    setEmailDialogUser(user);
    setEmailTemplateKey('refund');
    setEmailSubject(tpl.subject);
    setEmailBody(tpl.body(user.name));
  };

  const handleTemplateChange = (key: EmailTemplateKey) => {
    setEmailTemplateKey(key);
    const tpl = EMAIL_TEMPLATES[key];
    setEmailSubject(tpl.subject);
    setEmailBody(tpl.body(emailDialogUser?.name || ''));
  };

  const handleSendEmail = async () => {
    if (!emailDialogUser) return;
    const subject = emailSubject.trim();
    const body = emailBody.trim();
    if (!subject || !body) {
      toast.error('Заполните тему и текст письма');
      return;
    }
    setIsSendingEmail(true);
    try {
      const response = await fetch(ADMIN_SEND_EMAIL_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          user_id: emailDialogUser.id,
          subject,
          body_text: body,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        toast.success(`Письмо отправлено на ${data.to_email || emailDialogUser.email}`);
        setEmailDialogUser(null);
      } else {
        toast.error(`Ошибка отправки: ${data.error || 'неизвестная ошибка'}`);
      }
    } catch (e) {
      toast.error('Ошибка соединения');
    } finally {
      setIsSendingEmail(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage]);

  const fetchUsers = async () => {
    setIsLoading(true);

    try {
      const offset = (currentPage - 1) * usersPerPage;
      const response = await fetch(`${ADMIN_API}?action=users&limit=${usersPerPage}&offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${getAdminToken()}` }
      });

      if (response.status === 401) {
        navigate('/vf-console');
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users);
      setTotalUsers(data.total);
    } catch (error) {
      toast.error('Ошибка загрузки пользователей');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleUnlimitedAccess = async (userEmail: string, currentAccess: boolean) => {
    const newAccess = !currentAccess;

    try {
      const response = await fetch(ADMIN_MANAGE_ACCESS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminToken()}`
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
              <p className="text-muted-foreground">Всего пользователей: {totalUsers}</p>
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
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant={user.unlimited_access ? "outline" : "default"}
                                onClick={() => handleToggleUnlimitedAccess(user.email, user.unlimited_access || false)}
                              >
                                {user.unlimited_access ? 'Отключить безлимит' : 'Включить безлимит'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEmailDialog(user)}
                                title="Отправить письмо"
                              >
                                <Icon name="Mail" size={16} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {totalUsers > usersPerPage && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <Icon name="ChevronLeft" size={16} />
                  Назад
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Страница {currentPage} из {Math.ceil(totalUsers / usersPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalUsers / usersPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(totalUsers / usersPerPage)}
                >
                  Вперёд
                  <Icon name="ChevronRight" size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!emailDialogUser} onOpenChange={(open) => !open && setEmailDialogUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Письмо пользователю</DialogTitle>
            <DialogDescription>
              {emailDialogUser ? `${emailDialogUser.name || 'Без имени'} (${emailDialogUser.email})` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Шаблон</Label>
              <Select value={emailTemplateKey} onValueChange={(v) => handleTemplateChange(v as EmailTemplateKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[]).map((key) => (
                    <SelectItem key={key} value={key}>{EMAIL_TEMPLATES[key].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Тема</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Например: Возврат средств"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>Текст письма</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={10}
                placeholder="Текст письма..."
                maxLength={20000}
              />
              <p className="text-xs text-muted-foreground">
                Подпись «С уважением, команда Fitting Room» добавляется автоматически.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogUser(null)} disabled={isSendingEmail}>
              Отмена
            </Button>
            <Button onClick={handleSendEmail} disabled={isSendingEmail}>
              {isSendingEmail ? (
                <>
                  <Icon name="Loader2" className="animate-spin mr-2" size={16} />
                  Отправка...
                </>
              ) : (
                <>
                  <Icon name="Send" className="mr-2" size={16} />
                  Отправить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
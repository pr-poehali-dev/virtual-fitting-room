import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  raw_email?: string;
  name: string;
  balance?: number;
  free_tries_used?: number;
  unlimited_access?: boolean;
  created_at: string;
  is_vk?: boolean;
  phone?: string;
  avatar_url?: string;
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
  const [emailTab, setEmailTab] = useState<'new' | 'history'>('new');

  interface EmailLogItem {
    id: string;
    subject: string;
    body_text: string;
    status: string;
    error_message: string | null;
    sent_at: string | null;
  }
  const [historyItems, setHistoryItems] = useState<EmailLogItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const historyPerPage = 10;

  const fetchHistory = async (userId: string, page: number) => {
    setIsLoadingHistory(true);
    try {
      const offset = (page - 1) * historyPerPage;
      const response = await fetch(
        `${ADMIN_SEND_EMAIL_API}?user_id=${encodeURIComponent(userId)}&limit=${historyPerPage}&offset=${offset}`,
        { headers: { 'Authorization': `Bearer ${getAdminToken()}` } },
      );
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistoryItems(data.emails || []);
      setHistoryTotal(data.total || 0);
    } catch {
      toast.error('Не удалось загрузить историю писем');
      setHistoryItems([]);
      setHistoryTotal(0);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (emailDialogUser && emailTab === 'history') {
      fetchHistory(emailDialogUser.id, historyPage);
    }
  }, [emailDialogUser, emailTab, historyPage]);

  const openEmailDialog = (user: User) => {
    const tpl = EMAIL_TEMPLATES.refund;
    setEmailDialogUser(user);
    setEmailTemplateKey('refund');
    setEmailSubject(tpl.subject);
    setEmailBody(tpl.body(user.name));
    setEmailTab('new');
    setHistoryItems([]);
    setHistoryTotal(0);
    setHistoryPage(1);
    setExpandedEmailId(null);
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
        if (historyPage === 1) {
          fetchHistory(emailDialogUser.id, 1);
        } else {
          setHistoryPage(1);
        }
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

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
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
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                {user.avatar_url ? (
                                  <AvatarImage src={user.avatar_url} alt={user.name} />
                                ) : null}
                                <AvatarFallback className="bg-purple-100 text-purple-700 text-sm font-medium">
                                  {(user.name?.trim()?.charAt(0) || '?').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {user.is_vk && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                      <Icon name="MessageCircle" size={12} />
                                      VK
                                    </span>
                                  )}
                                  <span>{user.email || <span className="text-gray-400">— без email</span>}</span>
                                </div>
                                {user.phone && (
                                  <span className="text-xs text-gray-500">{user.phone}</span>
                                )}
                              </div>
                            </div>
                          </td>
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
                                onClick={() => handleToggleUnlimitedAccess(user.raw_email || user.email, user.unlimited_access || false)}
                              >
                                {user.unlimited_access ? 'Отключить безлимит' : 'Включить безлимит'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEmailDialog(user)}
                                disabled={!user.email}
                                title={user.email ? 'Отправить письмо' : 'Нет email — письмо отправить нельзя'}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Письмо пользователю</DialogTitle>
            <DialogDescription>
              {emailDialogUser ? `${emailDialogUser.name || 'Без имени'} (${emailDialogUser.email})` : ''}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={emailTab} onValueChange={(v) => setEmailTab(v as 'new' | 'history')} className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">Новое письмо</TabsTrigger>
              <TabsTrigger value="history">
                История{historyTotal > 0 ? ` (${historyTotal})` : ''}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4 py-2">
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
            </TabsContent>

            <TabsContent value="history" className="py-2">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Icon name="Loader2" className="animate-spin" size={24} />
                </div>
              ) : historyItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Письма этому пользователю ещё не отправлялись
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {historyItems.map((item) => {
                      const isOpen = expandedEmailId === item.id;
                      return (
                        <div key={item.id} className="border rounded-md">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 flex items-start justify-between gap-3 hover:bg-gray-50"
                            onClick={() => setExpandedEmailId(isOpen ? null : item.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{item.subject}</span>
                                {item.status === 'sent' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                    <Icon name="Check" size={11} />
                                    Отправлено
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                    <Icon name="X" size={11} />
                                    Ошибка
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(item.sent_at)}</p>
                            </div>
                            <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={16} className="mt-1 text-gray-400" />
                          </button>
                          {isOpen && (
                            <div className="px-3 pb-3 pt-1 border-t bg-gray-50">
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{item.body_text}</pre>
                              {item.error_message && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                  <span className="font-semibold">Ошибка: </span>{item.error_message}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {historyTotal > historyPerPage && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage === 1 || isLoadingHistory}
                      >
                        <Icon name="ChevronLeft" size={14} />
                        Назад
                      </Button>
                      <span className="text-xs text-muted-foreground px-2">
                        Страница {historyPage} из {Math.ceil(historyTotal / historyPerPage)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage((p) => Math.min(Math.ceil(historyTotal / historyPerPage), p + 1))}
                        disabled={historyPage >= Math.ceil(historyTotal / historyPerPage) || isLoadingHistory}
                      >
                        Вперёд
                        <Icon name="ChevronRight" size={14} />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogUser(null)} disabled={isSendingEmail}>
              {emailTab === 'new' ? 'Отмена' : 'Закрыть'}
            </Button>
            {emailTab === 'new' && (
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
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

const ADMIN_API = 'https://functions.poehali.dev/6667a30b-a520-41d8-b23a-e240a9aefb15';

interface Payment {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  type: 'deposit' | 'charge' | 'refund';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  yookassa_payment_id: string | null;
  created_at: string;
  is_deleted: boolean;
}

export default function AdminPayments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const paymentsPerPage = 50;

  useEffect(() => {
    const adminToken = localStorage.getItem('admin_jwt');
    const tokenExpiry = localStorage.getItem('admin_jwt_expiry');

    if (!adminToken || !tokenExpiry) {
      navigate('/admin');
      return;
    }

    const expiryTime = new Date(tokenExpiry).getTime();
    if (Date.now() >= expiryTime) {
      localStorage.removeItem('admin_jwt');
      localStorage.removeItem('admin_jwt_expiry');
      navigate('/admin');
      return;
    }
    fetchPayments();
  }, [navigate, currentPage]);

  const fetchPayments = async () => {
    const adminToken = localStorage.getItem('admin_jwt');
    setIsLoading(true);

    try {
      const offset = (currentPage - 1) * paymentsPerPage;
      const response = await fetch(`${ADMIN_API}?action=payments&limit=${paymentsPerPage}&offset=${offset}`, {
        headers: { 'X-Admin-Token': adminToken || '' }
      });

      if (!response.ok) throw new Error('Failed to fetch payments');
      const data = await response.json();
      setPayments(data.payments || data);
      setTotalPayments(data.total || (data.payments ? data.payments.length : data.length));
    } catch (error) {
      toast.error('Ошибка загрузки платежей');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefund = async (userId: string, transactionId: string) => {
    const adminToken = localStorage.getItem('admin_jwt');
    const reason = prompt('Причина возврата (необязательно):') || 'Возврат администратором';

    if (!confirm('Вы уверены, что хотите вернуть 30₽ пользователю?')) {
      return;
    }

    setRefundingId(transactionId);

    try {
      const response = await fetch(`${ADMIN_API}?action=refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken || ''
        },
        body: JSON.stringify({
          user_id: userId,
          amount: 30,
          reason
        })
      });

      if (!response.ok) throw new Error('Refund failed');
      
      const data = await response.json();
      toast.success(`Возврат выполнен! Новый баланс: ${data.new_balance.toFixed(2)}₽`);
      fetchPayments();
    } catch (error) {
      toast.error('Ошибка возврата средств');
    } finally {
      setRefundingId(null);
    }
  };

  const totalDeposits = payments
    .filter(p => p.type === 'deposit')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const totalCharges = payments
    .filter(p => p.type === 'charge')
    .reduce((sum, p) => sum + Math.abs(p.amount), 0);

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
              <h1 className="text-3xl font-bold mb-2">История операций</h1>
              <p className="text-muted-foreground">
                Всего операций: {totalPayments} | Пополнения: {totalDeposits.toFixed(2)} ₽ | Списания: {totalCharges.toFixed(2)} ₽
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Пользователь</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Тип</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Сумма</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Описание</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">ID ЮКассы</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Баланс после</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Дата</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium">{payment.user_name}</div>
                            <div className="text-xs text-gray-500">{payment.user_email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              payment.type === 'deposit' 
                                ? 'bg-green-100 text-green-700'
                                : payment.type === 'refund'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {payment.type === 'deposit' ? 'Пополнение' : payment.type === 'refund' ? 'Возврат' : 'Списание'}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-sm font-medium ${
                            payment.type === 'deposit' || payment.type === 'refund' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {payment.type === 'deposit' || payment.type === 'refund' ? '+' : ''}
                            {payment.amount.toFixed(2)} ₽
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {payment.description}
                            {payment.is_deleted && (
                              <span className="ml-2 text-xs text-gray-500">(удалено)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                            {payment.yookassa_payment_id ? (
                              <div className="flex items-center gap-1">
                                <span className="truncate max-w-[200px]" title={payment.yookassa_payment_id}>
                                  {payment.yookassa_payment_id}
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(payment.yookassa_payment_id!);
                                    toast.success('ID скопирован');
                                  }}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Icon name="Copy" size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{payment.balance_after.toFixed(2)} ₽</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(payment.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {payment.type === 'charge' && payment.amount < 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRefund(payment.user_id, payment.id)}
                                disabled={refundingId === payment.id}
                              >
                                {refundingId === payment.id ? (
                                  <>
                                    <Icon name="Loader2" className="animate-spin mr-1" size={14} />
                                    Возврат...
                                  </>
                                ) : (
                                  <>
                                    <Icon name="RefreshCw" className="mr-1" size={14} />
                                    Вернуть
                                  </>
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {totalPayments > paymentsPerPage && (
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
                  Страница {currentPage} из {Math.ceil(totalPayments / paymentsPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalPayments / paymentsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(totalPayments / paymentsPerPage)}
                >
                  Вперёд
                  <Icon name="ChevronRight" size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
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
  amount: number;
  payment_method: string;
  status: string;
  order_id: string;
  created_at: string;
  updated_at: string;
}

export default function AdminPayments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const paymentsPerPage = 50;

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_auth');
    if (!adminAuth) {
      navigate('/admin');
      return;
    }
    fetchPayments();
  }, [navigate, currentPage]);

  const fetchPayments = async () => {
    const adminPassword = sessionStorage.getItem('admin_auth');
    setIsLoading(true);

    try {
      const offset = (currentPage - 1) * paymentsPerPage;
      const response = await fetch(`${ADMIN_API}?action=payments&limit=${paymentsPerPage}&offset=${offset}`, {
        headers: { 'X-Admin-Password': adminPassword || '' }
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

  const totalAmount = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

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
              <h1 className="text-3xl font-bold mb-2">Платежи</h1>
              <p className="text-muted-foreground">
                Всего платежей: {totalPayments} | Сумма: {totalAmount.toFixed(2)} ₽
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Пользователь</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Сумма</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Метод</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Статус</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Order ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium">{payment.user_name}</div>
                            <div className="text-xs text-gray-500">{payment.user_email}</div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{payment.amount.toFixed(2)} ₽</td>
                          <td className="px-4 py-3 text-sm">{payment.payment_method}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              payment.status === 'completed' 
                                ? 'bg-green-100 text-green-700'
                                : payment.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {payment.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">{payment.order_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(payment.created_at).toLocaleDateString()}
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
import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';

const USER_BALANCE_API = 'https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1';

interface BalanceInfo {
  balance: number;
  unlimited_access: boolean;
}

export default function HeaderBalance() {
  const { user } = useAuth();
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
  }, [user]);

  const fetchBalance = async () => {
    if (!user) return;

    try {
      const response = await fetch(USER_BALANCE_API, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setBalanceInfo(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки баланса:', error);
    }
  };

  if (!balanceInfo) return null;

  if (balanceInfo.unlimited_access) {
    return (
      <div className="flex items-center gap-1.5 text-primary">
        <Icon name="Infinity" size={20} className="hidden lg:inline" />
        <Icon name="Infinity" size={18} className="lg:hidden" />
        <span className="text-sm font-medium hidden lg:inline">Безлимит</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Icon name="Wallet" size={20} className="hidden lg:inline text-muted-foreground" />
      <Icon name="Wallet" size={18} className="lg:hidden text-muted-foreground" />
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground hidden lg:inline">Баланс</span>
        <span className="text-sm font-medium">{balanceInfo.balance.toFixed(0)} ₽</span>
      </div>
    </div>
  );
}
import Icon from '@/components/ui/icon';
import { useBalance } from '@/context/BalanceContext';

interface HeaderBalanceProps {
  variant?: 'default' | 'light';
}

export default function HeaderBalance({ variant = 'default' }: HeaderBalanceProps) {
  const { balanceInfo } = useBalance();

  if (!balanceInfo) return null;

  const isLight = variant === 'light';
  const iconClass = isLight ? 'text-purple-300' : 'text-muted-foreground';
  const labelClass = isLight ? 'text-purple-300' : 'text-muted-foreground';
  const valueClass = isLight ? 'text-purple-300' : '';

  if (balanceInfo.unlimited_access) {
    return (
      <div className={`flex items-center gap-1.5 ${isLight ? 'text-purple-300' : 'text-primary'}`}>
        <Icon name="Infinity" size={20} className="hidden lg:inline" />
        <Icon name="Infinity" size={18} className="lg:hidden" />
        <span className="text-sm font-medium hidden lg:inline">Безлимит</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Icon name="Wallet" size={20} className={`hidden lg:inline ${iconClass}`} />
      <Icon name="Wallet" size={18} className={`lg:hidden ${iconClass}`} />
      <div className="flex items-center gap-1">
        <span className={`text-sm hidden lg:inline ${labelClass}`}>Баланс</span>
        <span className={`text-sm font-medium ${valueClass}`}>{balanceInfo.balance.toFixed(0)} ₽</span>
      </div>
    </div>
  );
}
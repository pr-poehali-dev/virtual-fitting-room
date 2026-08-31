import Icon from '@/components/ui/icon';
import { Link } from 'react-router-dom';
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
      <Link
        to="/profile/wallet"
        className={`flex items-center gap-1.5 rounded-lg px-1 transition-opacity hover:opacity-80 ${isLight ? 'text-purple-300' : 'text-primary'}`}
      >
        <Icon name="Infinity" size={20} className="hidden lg:inline" />
        <Icon name="Infinity" size={18} className="lg:hidden" />
        <span className="text-sm font-medium hidden lg:inline">Безлимит</span>
      </Link>
    );
  }

  const bonus = balanceInfo.bonus_balance ?? 0;

  return (
    <Link
      to="/profile/wallet"
      className="flex items-center gap-1.5 rounded-lg px-1 transition-opacity hover:opacity-80"
      title={
        bonus > 0
          ? `Из них ${bonus.toFixed(0)} ₽ бонусных`
          : undefined
      }
    >
      <Icon name="Wallet" size={20} className={`hidden lg:inline ${iconClass}`} />
      <Icon name="Wallet" size={18} className={`lg:hidden ${iconClass}`} />
      <div className="flex flex-col leading-tight">
        <div className="flex items-center gap-1">
          <span className={`text-sm hidden lg:inline ${labelClass}`}>Баланс</span>
          <span className={`text-sm font-medium ${valueClass}`}>{balanceInfo.balance.toFixed(0)} ₽</span>
          {bonus > 0 && (
            <span
              className={`lg:hidden flex items-center gap-0.5 text-[10px] font-medium whitespace-nowrap ${isLight ? 'text-purple-300' : 'text-primary'}`}
            >
              <Icon name="Gift" size={11} />
              {bonus.toFixed(0)}
            </span>
          )}
        </div>
        {bonus > 0 && (
          <span className={`text-[11px] whitespace-nowrap hidden lg:inline ${isLight ? 'text-purple-300/80' : 'text-primary'}`}>
            в т.ч. {bonus.toFixed(0)} ₽ бонусных
          </span>
        )}
      </div>
    </Link>
  );
}
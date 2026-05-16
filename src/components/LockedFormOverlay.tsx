import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useBalance } from "@/context/BalanceContext";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

interface LockedFormOverlayProps {
  cost: number;
  children: ReactNode;
  className?: string;
}

const LockedFormOverlay = ({ cost, children, className = "" }: LockedFormOverlayProps) => {
  const { user, isLoading: authLoading } = useAuth();
  const { balanceInfo } = useBalance();
  const navigate = useNavigate();

  const isAuthLocked = !authLoading && !user;

  const hasUnlimited = balanceInfo?.unlimited_access === true;
  const currentBalance = balanceInfo?.balance ?? 0;
  const isBalanceLocked = !!user && !hasUnlimited && currentBalance < cost;

  const showOverlay = isAuthLocked || isBalanceLocked;

  if (!showOverlay) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white/50 backdrop-blur-md">
        <div className="mx-4 mt-6 max-w-sm rounded-2xl bg-white/90 p-6 text-center shadow-lg ring-1 ring-black/5">
          {isAuthLocked ? (
            <>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
                <Icon name="Lock" size={28} className="text-purple-600" />
              </div>
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                Войдите, чтобы продолжить
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Для использования функции нужен аккаунт
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => navigate("/login")}
                  className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                >
                  Войти
                </Button>
                <Button
                  onClick={() => navigate("/register")}
                  variant="outline"
                  className="flex-1 border-purple-600 text-purple-600 hover:bg-purple-50"
                >
                  Зарегистрироваться
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
                <Icon name="Wallet" size={28} className="text-purple-600" />
              </div>
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                Недостаточно средств
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                На счету {currentBalance} ₽, нужно {cost} ₽
              </p>
              <Button
                onClick={() => navigate("/profile/wallet")}
                className="w-full bg-purple-600 text-white hover:bg-purple-700"
              >
                Пополнить счёт
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LockedFormOverlay;
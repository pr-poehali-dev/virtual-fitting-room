import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useBalance } from "@/context/BalanceContext";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import VkAuthButton from "@/components/VkAuthButton";
import func2url from "../../backend/func2url.json";

interface LockedFormOverlayProps {
  cost: number;
  children: ReactNode;
  className?: string;
}

const LockedFormOverlay = ({
  cost,
  children,
  className = "",
}: LockedFormOverlayProps) => {
  const { user, isLoading: authLoading } = useAuth();
  const { balanceInfo } = useBalance();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;

  const isAuthLocked = !authLoading && !user;

  // Согласия для входа через VK: он создаёт аккаунт, если человека ещё нет
  const [vkConsent, setVkConsent] = useState(false);

  // Бонус за регистрацию: человек, зашедший не с главной, о нём не знает.
  // Размер берём из базы, как в плашке на главной — чтобы не разъезжались
  const [signupBonus, setSignupBonus] = useState<number | null>(null);
  useEffect(() => {
    if (!isAuthLocked) return;
    fetch(`${func2url["bonus-api"]}?action=promotions`)
      .then((res) => res.json())
      .then((data) => {
        const reg = (data.promotions || []).find(
          (p: { trigger_type: string; bonus_amount: number }) =>
            p.trigger_type === "registration",
        );
        setSignupBonus(reg ? reg.bonus_amount : null);
      })
      .catch(() => setSignupBonus(null));
  }, [isAuthLocked]);

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

      <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-white/40 backdrop-blur-sm">
        <div className="mx-4 mt-6 max-w-sm rounded-2xl bg-white/90 p-6 text-center shadow-lg ring-1 ring-black/5">
          {isAuthLocked ? (
            <>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
                <Icon name="Lock" size={28} className="text-purple-600" />
              </div>
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                Войдите, чтобы продолжить
              </h3>
              {/* Текст общий для всех сервисов: примерочная, расклады,
                  подбор образов, консультации — упоминать генерацию картинок
                  нельзя, она есть не везде */}
              <p className="mb-3 text-sm text-gray-600">
                Чтобы воспользоваться сервисом, войдите в аккаунт или
                зарегистрируйтесь. Для оплаты услуги нужно пополнить баланс
                минимум на {cost} рублей.
              </p>

              {/* Про бонус знают только те, кто заходил с главной — напоминаем здесь */}
              {signupBonus ? (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3 text-left">
                  <Icon
                    name="Gift"
                    size={18}
                    className="mt-0.5 shrink-0 text-purple-600"
                  />
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-purple-700">
                      Дарим {signupBonus.toFixed(0)} ₽ за регистрацию
                    </span>{" "}
                    — бонусные рубли зачислим сразу, потратить их можно в течение
                    30 дней на любые услуги сайта.
                  </p>
                </div>
              ) : (
                <div className="mb-4" />
              )}
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

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">или</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {/* Вход через VK создаёт аккаунт, если его ещё нет —
                  значит согласия нужны так же, как при регистрации */}
              <div className="mb-3 flex items-start space-x-2 text-left">
                <input
                  type="checkbox"
                  id="overlayVkConsent"
                  checked={vkConsent}
                  onChange={(e) => setVkConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="overlayVkConsent" className="text-sm text-gray-600">
                  Я принимаю{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="text-purple-600 hover:underline"
                  >
                    Политику конфиденциальности
                  </Link>{" "}
                  и даю согласие на{" "}
                  <Link
                    to="/personal-data"
                    target="_blank"
                    className="text-purple-600 hover:underline"
                  >
                    обработку персональных данных
                  </Link>
                </label>
              </div>
              <VkAuthButton
                className="flex justify-center"
                redirectTo={currentPath}
                requireConsent
                consentGiven={vkConsent}
              />
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
                <Icon name="Wallet" size={28} className="text-purple-600" />
              </div>
              <h3 className="mb-1 text-lg font-semibold text-gray-900">
                Пополните баланс
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Перед новой генерацией необходимо пополнить баланс. На счету{" "}
                {currentBalance} ₽, нужно {cost} ₽
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
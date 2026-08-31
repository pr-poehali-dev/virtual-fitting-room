import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import func2url from "../../backend/func2url.json";

interface Promotion {
  code: string;
  title: string;
  bonus_amount: number;
  trigger_type: string;
  min_amount: number;
}

export default function PromoBanner() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    fetch(`${func2url["bonus-api"]}?action=promotions`)
      .then((res) => res.json())
      .then((data) => setPromotions(data.promotions || []))
      .catch(() => setPromotions([]));
  }, []);

  // Акций нет — плашки тоже нет
  if (promotions.length === 0) return null;

  const maxBonus = Math.max(...promotions.map((p) => p.bonus_amount));
  const hasRegistration = promotions.some(
    (p) => p.trigger_type === "registration",
  );
  const registrationBonus = promotions.find(
    (p) => p.trigger_type === "registration",
  );

  return (
    <Link
      to="/promotions"
      className="group block mb-8 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 p-[1.5px] transition-transform hover:scale-[1.01]"
    >
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gray-900 px-5 py-4 sm:px-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-600">
          <Icon name="Gift" size={22} className="text-white" />
        </div>

        <div className="min-w-[200px] flex-1">
          <p className="font-semibold text-white">
            {hasRegistration && registrationBonus
              ? `Дарим ${registrationBonus.bonus_amount.toFixed(0)} бонусных рублей за регистрацию`
              : `Бонусы до ${maxBonus.toFixed(0)} ₽ за пополнение счёта`}
          </p>
          <p className="text-sm text-gray-400">
            {hasRegistration
              ? `И до ${maxBonus.toFixed(0)} ₽ бонусами при пополнении счёта`
              : "Бонусные рубли тратятся на любые услуги сайта"}
          </p>
        </div>

        <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-white/20">
          Смотреть акции
          <Icon
            name="ArrowRight"
            size={16}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  );
}

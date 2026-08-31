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
      className="group relative block mb-8 overflow-hidden rounded-2xl border border-purple-400/30 bg-white/[0.07] px-5 py-4 backdrop-blur-md transition-all hover:border-purple-400/50 hover:bg-white/[0.11] sm:px-6"
    >
      {/* Тёплое свечение слева — акцент без кислотности */}
      <span className="pointer-events-none absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-purple-500/25 blur-3xl" />
      <span className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-pink-400/15 blur-3xl" />

      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
          <Icon name="Gift" size={21} className="text-white" />
        </div>

        <div className="min-w-[180px] flex-1">
          <p className="font-semibold text-white leading-snug">
            {hasRegistration && registrationBonus
              ? `Дарим ${registrationBonus.bonus_amount.toFixed(0)} бонусных рублей за регистрацию`
              : `Бонусы до ${maxBonus.toFixed(0)} ₽ за пополнение счёта`}
          </p>
          <p className="text-sm text-gray-300 leading-snug">
            {hasRegistration
              ? `И до ${maxBonus.toFixed(0)} ₽ бонусами при пополнении счёта`
              : "Бонусные рубли тратятся на любые услуги сайта"}
          </p>
        </div>

        <span className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple-500/25 transition-shadow group-hover:shadow-lg group-hover:shadow-purple-500/40">
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
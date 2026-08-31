import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { useTopupPromotions } from "@/hooks/useTopupPromotions";

export default function TopupBonusHint() {
  const { topups } = useTopupPromotions();

  if (topups.length === 0) return null;

  const first = topups[0];
  const best = topups.reduce((a, b) => (b.bonus_amount > a.bonus_amount ? b : a));

  return (
    <Link
      to="/promotions"
      className="group mt-4 flex items-center gap-3 rounded-xl border border-purple-400/40 bg-gradient-to-r from-purple-50 to-pink-50 px-3 py-2.5 transition-colors hover:border-purple-400/70 hover:from-purple-100 hover:to-pink-100 dark:from-purple-500/10 dark:to-pink-500/10"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
        <Icon name="Gift" size={16} className="text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-purple-900 dark:text-purple-100">
          +{first.bonus_amount.toFixed(0)} ₽ бонусами от{" "}
          {first.min_amount.toFixed(0)} ₽
        </p>
        <p className="text-xs leading-snug text-purple-700/80 dark:text-purple-200/70">
          {best.bonus_amount > first.bonus_amount
            ? `Чем больше сумма, тем больше подарок — до ${best.bonus_amount.toFixed(0)} ₽`
            : "Бонусные рубли тратятся на любые услуги"}
        </p>
      </div>

      <Icon
        name="ChevronRight"
        size={16}
        className="shrink-0 text-purple-500 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
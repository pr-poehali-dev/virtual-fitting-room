import { useEffect, useState } from "react";
import func2url from "../../backend/func2url.json";

export interface TopupPromotion {
  code: string;
  title: string;
  bonus_amount: number;
  trigger_type: string;
  min_amount: number;
}

/** Акции за пополнение счёта, отсортированные по минимальной сумме. */
export function useTopupPromotions() {
  const [topups, setTopups] = useState<TopupPromotion[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`${func2url["bonus-api"]}?action=promotions`)
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        const list: TopupPromotion[] = (data.promotions || [])
          .filter(
            (p: TopupPromotion) =>
              p.trigger_type === "topup" && p.bonus_amount > 0,
          )
          .sort(
            (a: TopupPromotion, b: TopupPromotion) =>
              a.min_amount - b.min_amount,
          );
        setTopups(list);
      })
      .catch(() => {
        if (alive) setTopups([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Какой бонус получит человек за конкретную сумму пополнения. */
  const bonusFor = (amount: number) => {
    const suitable = topups.filter((p) => amount >= p.min_amount);
    if (suitable.length === 0) return 0;
    return Math.max(...suitable.map((p) => p.bonus_amount));
  };

  return { topups, bonusFor };
}

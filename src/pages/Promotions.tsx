import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import func2url from "../../backend/func2url.json";

interface Promotion {
  code: string;
  title: string;
  description: string;
  trigger_type: string;
  min_amount: number;
  bonus_amount: number;
  expires_days: number | null;
  ends_at: string | null;
}

const iconByTrigger: Record<string, string> = {
  registration: "UserPlus",
  topup: "Wallet",
  manual: "Gift",
  custom: "Sparkles",
};

const Promotions = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${func2url["bonus-api"]}?action=promotions`)
      .then((res) => res.json())
      .then((data) => setPromotions(data.promotions || []))
      .catch(() => setPromotions([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Акции и бонусы
            </h1>
            <p className="text-gray-700 max-w-2xl mx-auto">
              Бонусные рубли зачисляются на ваш счёт и тратятся на любые услуги
              сайта так же, как обычные деньги. Списываются они первыми — чтобы
              ничего не пропало.
            </p>
          </div>

          {isLoading ? (
            <div className="text-center py-16 text-gray-500">
              <Icon
                name="Loader2"
                size={32}
                className="animate-spin mx-auto mb-3"
              />
              Загружаем акции
            </div>
          ) : promotions.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
              <Icon
                name="Sparkles"
                size={40}
                className="text-purple-400 mx-auto mb-4"
              />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Сейчас активных акций нет
              </h2>
              <p className="text-gray-600 mb-6">
                Загляните позже — мы регулярно запускаем новые предложения.
              </p>
              <Link to="/profile/wallet">
                <Button variant="outline">Перейти в кошелёк</Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {promotions.map((promo) => (
                <div
                  key={promo.code}
                  className="bg-white rounded-2xl shadow-lg p-6 flex flex-col"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="bg-purple-100 rounded-xl p-3">
                      <Icon
                        name={iconByTrigger[promo.trigger_type] || "Sparkles"}
                        size={24}
                        className="text-purple-600"
                      />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {promo.title}
                      </h2>
                      <p className="text-2xl font-bold text-purple-600 mt-1">
                        +{promo.bonus_amount.toFixed(0)} ₽
                      </p>
                    </div>
                  </div>

                  {promo.description && (
                    <p className="text-gray-700 text-sm mb-4 flex-1">
                      {promo.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm text-gray-600 border-t pt-4">
                    {promo.trigger_type === "topup" && promo.min_amount > 0 && (
                      <div className="flex items-center gap-2">
                        <Icon name="Check" size={16} className="text-green-600" />
                        При пополнении от {promo.min_amount.toFixed(0)} ₽
                      </div>
                    )}
                    {promo.trigger_type === "registration" && (
                      <div className="flex items-center gap-2">
                        <Icon name="Check" size={16} className="text-green-600" />
                        Начисляется сразу после регистрации
                      </div>
                    )}
                    {promo.expires_days ? (
                      <div className="flex items-center gap-2">
                        <Icon name="Clock" size={16} className="text-amber-600" />
                        Действуют {promo.expires_days} дней после начисления
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Icon
                          name="Infinity"
                          size={16}
                          className="text-green-600"
                        />
                        Не сгорают
                      </div>
                    )}
                    {promo.ends_at && (
                      <div className="flex items-center gap-2">
                        <Icon name="CalendarDays" size={16} />
                        Акция до{" "}
                        {new Date(promo.ends_at).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-10 bg-white rounded-2xl shadow-lg p-6 md:p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon name="FileText" size={22} className="text-purple-600" />
              Правила начисления и использования бонусов
            </h2>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-3">
                <Icon
                  name="Check"
                  size={18}
                  className="text-green-600 shrink-0 mt-0.5"
                />
                <span>
                  Бонусные рубли зачисляются на счёт и тратятся на любые услуги
                  сайта наравне с обычными деньгами.
                </span>
              </li>
              <li className="flex gap-3">
                <Icon
                  name="Check"
                  size={18}
                  className="text-green-600 shrink-0 mt-0.5"
                />
                <span>
                  При оплате услуги бонусные рубли списываются в первую очередь,
                  и только затем собственные средства.
                </span>
              </li>
              <li className="flex gap-3">
                <Icon
                  name="Clock"
                  size={18}
                  className="text-amber-600 shrink-0 mt-0.5"
                />
                <span>
                  У бонусов может быть срок действия. Неиспользованные бонусные
                  рубли сгорают в указанную дату — она видна в кошельке.
                </span>
              </li>
              <li className="flex gap-3">
                <Icon
                  name="TriangleAlert"
                  size={18}
                  className="text-red-500 shrink-0 mt-0.5"
                />
                <span>
                  <strong>Бонусные рубли не выводятся и не возвращаются на
                  карту.</strong> Если вы начали тратить средства со счёта,
                  возврат на карту по этой сумме не производится: бонусная часть
                  списывается первой и денежному возмещению не подлежит.
                </span>
              </li>
              <li className="flex gap-3">
                <Icon
                  name="UserCheck"
                  size={18}
                  className="text-purple-600 shrink-0 mt-0.5"
                />
                <span>
                  Бонус за регистрацию начисляется один раз. При повторной
                  регистрации на тот же адрес электронной почты он не выдаётся.
                </span>
              </li>
              <li className="flex gap-3">
                <Icon
                  name="Settings"
                  size={18}
                  className="text-gray-500 shrink-0 mt-0.5"
                />
                <span>
                  Администрация вправе изменять условия акций, а также
                  начислять и отменять бонусы при выявлении злоупотреблений.
                </span>
              </li>
            </ul>

            <div className="mt-6 pt-6 border-t text-center">
              <Link to="/profile/wallet">
                <Button>Открыть кошелёк</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Promotions;
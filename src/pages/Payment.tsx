import { Link } from "react-router-dom";
import Icon from "@/components/ui/icon";

const Payment = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto px-4 py-12">
        <Link 
          to="/" 
          className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-700 mb-8"
        >
          <Icon name="ArrowLeft" size={20} />
          <span>На главную</span>
        </Link>

        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Информация об оплате
          </h1>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">Способы оплаты</h2>
              <p className="mb-4">
                Мы принимаем следующие способы оплаты:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Банковские карты (Visa, MasterCard, Мир)</li>
                <li>Электронные кошельки</li>
                <li>Банковский перевод для юридических лиц</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">Тарифы</h2>
              <p className="mb-4">
                Стоимость услуг зависит от выбранного тарифа. Вы можете ознакомиться с актуальными ценами в личном кабинете после регистрации.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">Безопасность платежей</h2>
              <p>
                Все платежи проходят через защищенное соединение. Мы не храним данные ваших банковских карт. 
                Обработка платежей осуществляется сертифицированными платежными системами.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-gray-900">Возврат средств</h2>
              <p>
                Возврат средств возможен в течение 14 дней с момента оплаты при условии неиспользования услуги. 
                Для оформления возврата свяжитесь с нами через страницу контактов.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;

import Layout from "@/components/Layout";
import Icon from "@/components/ui/icon";

const Contacts = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Контакты
          </h1>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                Свяжитесь с нами
              </h2>
              <p className="text-gray-700 mb-6">
                Мы всегда рады помочь вам! Если у вас есть вопросы, предложения
                или вам нужна техническая поддержка, используйте один из
                способов связи ниже.
              </p>

              <div className="space-y-4">
                <div className="flex items-start space-x-4 p-4 bg-purple-50 rounded-lg">
                  <Icon
                    name="Mail"
                    size={24}
                    className="text-purple-600 mt-1"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Электронная почта
                    </h3>
                    <a
                      href="mailto:styleselect@mail.ru"
                      className="text-purple-600 hover:text-purple-700"
                    >
                      styleselect@mail.ru
                    </a>
                    <p className="text-sm text-gray-600 mt-1">
                      Ответим в течение 24 часов
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 bg-pink-50 rounded-lg">
                  <Icon
                    name="MessageCircle"
                    size={24}
                    className="text-pink-600 mt-1"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Telegram
                    </h3>
                    <a
                      href="https://t.me/styleselect_fashion"
                      className="text-pink-600 hover:text-pink-700"
                    >
                      @styleselect_fashion
                    </a>
                    <p className="text-sm text-gray-600 mt-1">
                      Быстрая поддержка в мессенджере
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4 p-4 bg-blue-50 rounded-lg">
                  <Icon name="Clock" size={24} className="text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Время работы
                    </h3>
                    <p className="text-gray-700">
                      Понедельник - Пятница: 9:00 - 18:00 (МСК)
                    </p>
                    <p className="text-gray-700">
                      Суббота - Воскресенье: выходной
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Автоматические ответы доступны круглосуточно
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">
                Часто задаваемые вопросы
              </h2>
              <div className="space-y-4">
                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Как начать использовать сервис?
                  </h3>
                  <p className="text-gray-700">
                    Зарегистрируйтесь на сайте, загрузите своё фото и выберите
                    нужную услугу: виртуальную примерку или определение
                    цветотипа.
                  </p>
                </div>

                <div className="border-l-4 border-pink-500 pl-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Какие фото нужно загружать?
                  </h3>
                  <p className="text-gray-700">
                    Для лучших результатов используйте фотографии хорошего
                    качества с равномерным освещением и четким изображением
                    лица.
                  </p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Как долго обрабатываются результаты?
                  </h3>
                  <p className="text-gray-700">
                    Обработка занимает от 30 секунд до 2 минут в зависимости от
                    загрузки системы.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-3 text-gray-900">
                Не нашли ответ на свой вопрос?
              </h2>
              <p className="text-gray-700 mb-4">
                Напишите нам, и мы обязательно поможем вам разобраться!
              </p>
              <a
                href="mailto:styleselect@mail.ru"
                className="inline-flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Icon name="Send" size={20} />
                <span>Написать в поддержку</span>
              </a>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Contacts;

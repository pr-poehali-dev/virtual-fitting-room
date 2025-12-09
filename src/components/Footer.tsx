import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const Footer = () => {
  const { user } = useAuth();

  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold text-white">StyleAI</span>
            </div>
            <p className="text-sm leading-relaxed">
              Здесь вы сможете быстро примерить одежду онлайн и сэкономить время на примерке большого количества вещей, чтобы подобрать лучший вариант для вас, а также определить цветовую палитру оттенков, которые идеально сочетаются с вашей природной внешностью.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Сервисы</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Онлайн примерочная
                </Link>
              </li>
              <li>
                <Link to="/colortype" className="hover:text-white transition-colors">
                  Определение цветотипа
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Информация</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/payment" className="hover:text-white transition-colors">
                  Информация об оплате
                </Link>
              </li>
              <li>
                <Link to="/offer" className="hover:text-white transition-colors">
                  Оферта
                </Link>
              </li>
              <li>
                <Link to="/contacts" className="hover:text-white transition-colors">
                  Контакты
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">
              {user ? "Аккаунт" : "Вход"}
            </h3>
            <ul className="space-y-2">
              {user ? (
                <li>
                  <Link to="/profile" className="hover:text-white transition-colors">
                    Личный кабинет
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link to="/login" className="hover:text-white transition-colors">
                      Войти
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:text-white transition-colors">
                      Регистрация
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} StyleAI. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

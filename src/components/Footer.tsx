import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Icon from "@/components/ui/icon";

const Footer = () => {
  const { user } = useAuth();

  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 2L6 10L8 24L16 30L24 24L26 10L16 2Z" fill="url(#diamond-gradient)" stroke="white" strokeWidth="1.5" strokeLinejoin="bevel"/>
                <path d="M6 10L16 16L26 10M16 16V30M8 24L16 16L24 24" stroke="white" strokeWidth="1.5" strokeLinejoin="bevel" opacity="0.7"/>
                <defs>
                  <linearGradient id="diamond-gradient" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a855f7"/>
                    <stop offset="1" stopColor="#ec4899"/>
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-xl font-bold text-white">StyleSelect</span>
            </div>
            <p className="text-sm leading-relaxed">
              Быстрая виртуальная примерка одежды и определение цветотипа. Экономьте время — подберите идеальный образ и палитру оттенков, которые идеально подчеркнут Вашу природную красоту.
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
                <Link to="/privacy" className="hover:text-white transition-colors">
                  Конфиденциальность
                </Link>
              </li>
              <li>
                <Link to="/personal-data" className="hover:text-white transition-colors">
                  Обработка персональных данных
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
          <p>&copy; {new Date().getFullYear()} StyleSelect. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
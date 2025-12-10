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
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2L15.5 9.5L22 8L17 14L24 16L17 18L20 24L14 19L8 24L11 18L4 16L11 14L6 8L12.5 9.5L14 2Z" fill="white"/>
                  <circle cx="14" cy="14" r="3" fill="url(#star-gradient)"/>
                  <defs>
                    <linearGradient id="star-gradient" x1="11" y1="11" x2="17" y2="17" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#a855f7"/>
                      <stop offset="1" stopColor="#ec4899"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
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
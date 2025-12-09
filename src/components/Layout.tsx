import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import Footer from '@/components/Footer';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Виртуальная примерочная', icon: 'Shirt' },
    { path: '/colortype', label: 'Определение цветотипа', icon: 'Palette' },
    { path: '/profile', label: 'Личный кабинет', icon: 'User' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src="/logo-fitting-room-text.svg?v=2" alt="Virtual Fitting" className="h-8 md:h-10" />
            </Link>
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex gap-2 md:gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${
                      location.pathname === item.path
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Icon name={item.icon as any} size={18} />
                    <span className="hidden md:inline">{item.label}</span>
                  </Link>
                ))}
              </div>
              {user ? (
                <div className="flex items-center gap-2 ml-2 border-l pl-2 md:pl-4">
                  <span className="text-sm text-muted-foreground hidden md:inline">{user.name}</span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <Icon name="LogOut" size={16} className="md:mr-2" />
                    <span className="hidden md:inline">Выйти</span>
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 ml-2 border-l pl-2 md:pl-4">
                  <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
                    Войти
                  </Button>
                  <Button size="sm" onClick={() => navigate('/register')}>
                    Регистрация
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}
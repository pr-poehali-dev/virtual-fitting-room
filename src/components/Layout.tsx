import { Link, useLocation } from 'react-router-dom';
import Icon from '@/components/ui/icon';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Виртуальная примерочная', icon: 'Shirt' },
    { path: '/colortype', label: 'Определение цветотипа', icon: 'Palette' },
    { path: '/profile', label: 'Личный кабинет', icon: 'User' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Virtual Fitting</h1>
            </Link>
            <div className="flex gap-2 md:gap-6">
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
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import Footer from '@/components/Footer';
import Sidebar from '@/components/Sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-40">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                <Icon name="Menu" size={24} />
              </button>
              <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                <img src="/logo-fitting-room-text.svg?v=2" alt="Virtual Fitting" className="h-8 md:h-10" />
              </Link>
            </div>
            
            <div className="flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground hidden md:inline">{user.name}</span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <Icon name="LogOut" size={16} className="md:mr-2" />
                    <span className="hidden md:inline">Выйти</span>
                  </Button>
                </div>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate('/login')}
                    className="hidden md:flex"
                  >
                    Войти
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => navigate('/register')}
                    className="hidden md:flex"
                  >
                    Регистрация
                  </Button>
                  <button
                    onClick={() => navigate('/login')}
                    className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                    aria-label="Login"
                  >
                    <Icon name="User" size={24} />
                  </button>
                </>
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
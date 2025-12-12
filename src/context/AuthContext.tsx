import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  email_verified?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: User) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_API = 'https://functions.poehali.dev/589c58eb-91b4-4f2a-923c-6a91ed722a82';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    const tokenExpiry = sessionStorage.getItem('token_expiry');
    
    if (storedUser && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry, 10);
      if (Date.now() < expiryTime) {
        setUser(JSON.parse(storedUser));
      } else {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('session_token');
        sessionStorage.removeItem('token_expiry');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    sessionStorage.setItem('session_token', data.session_token);
    sessionStorage.setItem('token_expiry', expiryTime.toString());
    setUser(data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', email, password, name })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    if (data.user && data.session_token) {
      const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      sessionStorage.setItem('session_token', data.session_token);
      sessionStorage.setItem('token_expiry', expiryTime.toString());
      setUser(data.user);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('session_token');
    sessionStorage.removeItem('token_expiry');
    setUser(null);
  };

  const updateUser = (userData: User) => {
    sessionStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
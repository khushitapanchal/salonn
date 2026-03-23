"use client"
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

interface User {
  email: string;
  role: string;
}

interface DecodedToken {
  sub: string;
  role: string;
  exp: number;
}

interface AuthContextType {
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  loading: true
});

export const useAuth = () => useContext(AuthContext);

function isTokenValid(token: string): DecodedToken | null {
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    // Check if token is expired (with 60s buffer)
    if (decoded.exp * 1000 < Date.now() - 60000) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Initialize auth state from localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = isTokenValid(token);
      if (decoded) {
        setUser({ email: decoded.sub, role: decoded.role });
      } else {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  // Handle redirects
  useEffect(() => {
    if (loading) return;

    const isLoginPage = pathname === '/login';
    const isDashboard = pathname.startsWith('/dashboard');

    if (!user && isDashboard) {
      router.replace('/login');
    } else if (user && isLoginPage) {
      router.replace('/dashboard');
    }
  }, [user, loading, pathname, router]);

  const login = useCallback((token: string) => {
    localStorage.setItem('token', token);
    const decoded = jwtDecode<DecodedToken>(token);
    setUser({ email: decoded.sub, role: decoded.role });
    router.replace('/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

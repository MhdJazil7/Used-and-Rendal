'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale, translations } from '@/lib/i18n/translations';
import { UserRole } from '@/lib/types';

interface UserSessionState {
  userId: string;
  phone: string;
  fullName: string;
  displayName: string;
  roles: UserRole[];
  primaryRole: UserRole;
}

interface AppContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  user: UserSessionState | null;
  setUser: (u: UserSessionState | null) => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [user, setUser] = useState<UserSessionState | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const t = (key: string): string => {
    return translations[locale]?.[key] || translations['en']?.[key] || key;
  };

  const refreshSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUser(data.data.user);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AppContext.Provider
      value={{
        locale,
        setLocale,
        t,
        user,
        setUser,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        logout,
        refreshSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

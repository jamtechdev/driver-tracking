/**
 * Peak Transit login session — agency ID persistence and bootstrap.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { peakUserLogin } from '@/api/userLogin.api';
import {
  clearAgencySession,
  loadAgencySessionFromStorage,
  persistAgencySession,
  setAgencySession,
  type PeakLoginUser,
} from '@/services/agencySession.service';

interface SessionContextType {
  isReady: boolean;
  isLoggedIn: boolean;
  agencyId: string | null;
  user: PeakLoginUser | null;
  /** Bumps on session restore and each successful interactive login — drives post-login API bootstrap. */
  bootstrapKey: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [user, setUser] = useState<PeakLoginUser | null>(null);
  const [bootstrapKey, setBootstrapKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const session = await loadAgencySessionFromStorage();
      if (cancelled) return;

      if (session.agencyId) {
        setAgencyId(session.agencyId);
        setUser(session.user);
        setIsLoggedIn(true);
        setBootstrapKey(1);
      }

      setIsReady(true);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await peakUserLogin({ email, passwd: password });

    if (!response.success || !response.user?.defaultAgency) {
      const message =
        response.errormsg ||
        response.message ||
        'Login failed. Please check your username and password.';
      throw new Error(message);
    }

    const nextAgencyId = String(response.user.defaultAgency);
    setAgencySession(nextAgencyId, response.user);
    setAgencyId(nextAgencyId);
    setUser(response.user);
    setIsLoggedIn(true);
    setBootstrapKey((key) => key + 1);
    void persistAgencySession(nextAgencyId, response.user).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    setAgencyId(null);
    setUser(null);
    setIsLoggedIn(false);
    setBootstrapKey(0);
    await clearAgencySession();
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      isLoggedIn,
      agencyId,
      user,
      bootstrapKey,
      login,
      logout,
    }),
    [isReady, isLoggedIn, agencyId, user, bootstrapKey, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}

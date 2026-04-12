import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, setToken, removeToken, getMe } from './api';

interface AuthState {
  isLoading: boolean;
  isLoggedIn: boolean;
  user: any | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  isLoading: true,
  isLoggedIn: false,
  user: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);

  // On mount, check for existing token
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          const me = await getMe();
          setUser(me);
        }
      } catch {
        await removeToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (token: string) => {
    await setToken(token);
    const me = await getMe();
    setUser(me);
  };

  const signOut = async () => {
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isLoggedIn: !!user,
        user,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

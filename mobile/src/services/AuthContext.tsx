import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api } from './api';
import { registerForPushNotificationsAsync } from './notifications';

type AuthContextType = {
  user: any;
  session: Session | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null); // Our DB user profile
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session) {
        // Add a 5 second timeout to getMe so the app doesn't hang forever if backend is unreachable
        let timeoutId: NodeJS.Timeout;
        const fetchProfile = Promise.race([
          api.getMe(),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
          })
        ]).finally(() => clearTimeout(timeoutId));

        fetchProfile
          .then(profile => {
            if (!mounted) return;
            setUser(profile);
            registerForPushNotificationsAsync();
          })
          .catch(e => {
            console.warn("User not found in Postgres yet or timeout.", e);
            if (!mounted) return;
            setUser(null);
          })
          .finally(() => {
            if (mounted) setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        let timeoutId: NodeJS.Timeout;
        const fetchProfile = Promise.race([
          api.getMe(),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
          })
        ]).finally(() => clearTimeout(timeoutId));

        fetchProfile
          .then(profile => {
            setUser(profile);
            registerForPushNotificationsAsync();
          })
          .catch(e => {
            setUser(null);
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const refreshUser = async () => {
    if (session) {
      try {
        const profile = await api.getMe();
        setUser(profile);
      } catch (e) {
        console.error("Failed to fetch user profile", e);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

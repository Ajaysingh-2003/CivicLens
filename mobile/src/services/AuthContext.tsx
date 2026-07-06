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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        // Fetch user profile from our backend
        try {
          const profile = await api.getMe();
          setUser(profile);
          // Register for push notifications
          registerForPushNotificationsAsync();
        } catch (e) {
          console.warn("User not found in Postgres yet (likely in the middle of registration). Delaying redirect.");
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });
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

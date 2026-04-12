import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

type AuthContextType = {
  user: any;
  isLoading: boolean;
  login: (token: string, userData: any) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on app boot
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (token) {
          const userData = await api.getMe();
          setUser(userData);
        }
      } catch (e) {
        // Token invalid or network error
        await AsyncStorage.removeItem("access_token");
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (token: string, userData: any) => {
    await AsyncStorage.setItem("access_token", token);
    setUser(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("access_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
};

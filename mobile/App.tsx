import React, { useState } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from './components/AnimatedSplash';
import { AuthProvider, useAuth } from './src/services/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OtpScreen from './src/screens/OtpScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';

import MainTabNavigator from './src/navigation/MainTabNavigator';
import IssueDetailsScreen from './src/screens/IssueDetailsScreen';
import AccountDetailsScreen from './src/screens/AccountDetailsScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, isLoading } = useAuth();
  const [isSplashComplete, setIsSplashComplete] = useState(false);

  // Still show splash during async bootstrap or initial delay
  if (isLoading || !isSplashComplete) {
    return <SplashScreen onFinish={() => setIsSplashComplete(true)} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Authorized Views
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen name="IssueDetails" component={IssueDetailsScreen} />
          <Stack.Screen name="AccountDetails" component={AccountDetailsScreen} />
          <Stack.Screen name="MyReports" component={MyReportsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : (
        // Unauthorized Views
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="OtpScreen" component={OtpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useEffect } from 'react';

import Constants, { ExecutionEnvironment } from 'expo-constants';

let Notifications: any = null;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const shouldLoadNotifications = !(isExpoGo && Platform.OS === 'android');
if (shouldLoadNotifications) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log("Failed to load expo-notifications", e);
  }
}

const queryClient = new QueryClient();
export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  useEffect(() => {
    let subscription: any = null;
    
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo && Platform.OS === 'android') {
       console.log("Push notification listeners are not supported in Expo Go on Android.");
       return;
    }

    try {
      subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response.notification.request.content.data;
        if (data) {
          if (navigationRef.isReady()) {
            if (data.type === 'LEVEL_UP') {
              navigationRef.navigate('AccountDetails');
            } else if (data.issue_id) {
              navigationRef.navigate('IssueDetails', { issueId: data.issue_id });
            }
          }
        }
      });
    } catch (e) {
      console.log("Failed to add notification listener", e);
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
    </QueryClientProvider>
  );
}

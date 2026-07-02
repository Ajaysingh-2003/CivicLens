import React, { useState } from 'react';
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

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
    </QueryClientProvider>
  );
}

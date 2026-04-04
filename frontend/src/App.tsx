import { useState, useCallback } from "react";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import DashboardPage from "./components/DashboardPage";
import "./index.css";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (isAuthenticated || localStorage.getItem("access_token")) {
    return <DashboardPage />;
  }

  return <AuthPage onLoginSuccess={handleLoginSuccess} />;
}

export default App;

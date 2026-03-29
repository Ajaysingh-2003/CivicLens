import { useState, useCallback } from "react";
import SplashScreen from "./components/SplashScreen";
import AuthPage from "./components/AuthPage";
import "./index.css";

function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return <AuthPage />;
}

export default App;

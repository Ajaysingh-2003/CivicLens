import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("INITIALIZING...");

  useEffect(() => {
    const steps = [
      { at: 15, text: "LOADING ASSETS..." },
      { at: 40, text: "SYSTEM CHECKING..." },
      { at: 65, text: "CONNECTING SERVICES..." },
      { at: 88, text: "ALMOST READY..." },
      { at: 100, text: "LAUNCH" },
    ];

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + 2, 100);
        const step = steps.find((s) => next >= s.at && prev < s.at);
        if (step) setStatusText(step.text);
        return next;
      });
    }, 50);

    const timeout = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onFinish]);

  return (
    <div className="splash-screen">
      <div className="splash-logo-container">
        <div className="splash-logo-card">
          <img src="/logo.png" alt="CivicLens Logo" />
        </div>

        <div className="splash-brand-name">CivicLens</div>
        <div className="splash-divider" />
      </div>

      <div className="splash-progress-container">
        <div className="splash-progress-bar">
          <div
            className="splash-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="splash-status">
          <span className="splash-status-text">{statusText}</span>
          <span className="splash-status-text">{progress}%</span>
        </div>
      </div>

      <div className="splash-footer">
        <img src="/logo.png" alt="" />
        <span>CivicLens</span>
      </div>
    </div>
  );
}

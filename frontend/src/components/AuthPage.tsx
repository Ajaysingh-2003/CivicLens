import { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader,
  CheckCircle,
  AlertTriangle,
  KeyRound,
  Globe,
  Landmark,
  ShieldCheck
} from "lucide-react";
import { api } from "../api";
import CustomDropdown from "./CustomDropdown";

export default function AuthPage({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("CITIZEN");

  // Dynamic dropdown state
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  const [selectedState, setSelectedState] = useState<number | "">("");
  const [selectedCity, setSelectedCity] = useState<number | "">("");
  const [selectedDepartment, setSelectedDepartment] = useState<number | "">("");

  useEffect(() => {
    if (mode === "register" && (role === "GOVT_OFFICIAL" || role === "NGO_ADMIN")) {
      api.getStates().then(setStates).catch(console.error);
      api.getDepartments().then(setDepartments).catch(console.error);
    }
  }, [mode, role]);

  useEffect(() => {
    if (selectedState) {
      api.getCities(selectedState as number).then(setCities).catch(console.error);
    } else {
      setCities([]);
    }
    setSelectedCity("");
  }, [selectedState]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetForm = () => {
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    resetForm();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const data = await api.login(email, password);
      localStorage.setItem("access_token", data.access_token);
      setSuccess("Authenticated successfully! Redirecting to dashboard...");
      if (onLoginSuccess) setTimeout(onLoginSuccess, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.register(
        email, 
        password, 
        fullName, 
        role,
        selectedState ? Number(selectedState) : undefined,
        selectedCity ? Number(selectedCity) : undefined,
        selectedDepartment ? Number(selectedDepartment) : undefined
      );
      setSuccess("Account created successfully! Switching to login...");
      setTimeout(() => {
        setMode("login");
        resetForm();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-card-header">
          <img src="/logo.png" alt="CivicLens" className="auth-card-logo" />
          <div className="auth-card-tagline">
            The Digital Curator for Municipal Growth
          </div>
          <h1 className="auth-card-title">
            {mode === "login"
              ? "Welcome Back to CivicLens"
              : "Join CivicLens"}
          </h1>
          <p className="auth-card-subtitle">
            {mode === "login"
              ? "Sign in to access your dashboard."
              : "Register as a Municipal Official or Citizen."}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="alert-error">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}
        {success && (
          <div className="alert-success">
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        {/* === LOGIN FORM === */}
        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input
                  required
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input
                  required
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <a className="forgot-link" href="#">
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <Loader className="spinner" size={20} />
              ) : (
                <>
                  Secure Login <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* === REGISTER FORM === */}
        {mode === "register" && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-wrapper">
                <User className="input-icon" />
                <input
                  required
                  type="text"
                  className="form-input"
                  placeholder="e.g. Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input
                  required
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Access Role</label>
              <div className="input-wrapper">
                <Globe className="input-icon" />
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="CITIZEN">Citizen (Reporter)</option>
                  <option value="GOVT_OFFICIAL">
                    Government Official (Assignee)
                  </option>
                  <option value="NGO_ADMIN">
                    NGO Admin (Triage Dashboard)
                  </option>
                </select>
              </div>
            </div>

            {(role === "GOVT_OFFICIAL" || role === "NGO_ADMIN") && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <CustomDropdown 
                      options={states}
                      value={selectedState}
                      onChange={(val) => setSelectedState(val as number)}
                      placeholder="Select State"
                      icon={<Globe />}
                      searchable={true}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City / District</label>
                    <CustomDropdown 
                      options={cities}
                      value={selectedCity}
                      onChange={(val) => setSelectedCity(val as number)}
                      placeholder="Select City"
                      icon={<Landmark />}
                      disabled={!selectedState}
                      searchable={true}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <CustomDropdown 
                    options={departments}
                    value={selectedDepartment}
                    onChange={(val) => setSelectedDepartment(val as number)}
                    placeholder="Select Department"
                    icon={<ShieldCheck />}
                    searchable={false}
                  />
                </div>
              </>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Set Password</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    required
                    type="password"
                    className="form-input"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-wrapper">
                  <KeyRound className="input-icon" />
                  <input
                    required
                    type="password"
                    className="form-input"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <Loader className="spinner" size={20} />
              ) : (
                <>
                  Register Account <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Toggle */}
        <div className="auth-toggle">
          {mode === "login" ? (
            <>
              Don't have an official account?{" "}
              <button
                type="button"
                className="auth-toggle-link"
                onClick={toggleMode}
              >
                Create Account
              </button>
            </>
          ) : (
            <>
              Already an official?{" "}
              <button
                type="button"
                className="auth-toggle-link"
                onClick={toggleMode}
              >
                Back to Login
              </button>
            </>
          )}
        </div>

        {/* Trust Signals */}
        <div className="trust-section">
          <div className="trust-label">Trusted by municipalities worldwide</div>
          <div className="trust-badges">
            <div className="trust-badge">
              <ShieldCheck className="trust-badge-icon" />
              <span className="trust-badge-text">Secured</span>
            </div>
            <div className="trust-badge">
              <Landmark className="trust-badge-icon" />
              <span className="trust-badge-text">Municipal Standard</span>
            </div>
            <div className="trust-badge">
              <Lock className="trust-badge-icon" />
              <span className="trust-badge-text">Encrypted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Page Footer */}
      <div className="page-footer">
        <p>© 2026 CivicLens. All rights reserved.</p>
        <div className="page-footer-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Accessibility</a>
        </div>
      </div>
    </div>
  );
}

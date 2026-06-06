import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  login,
  register,
  loginWithGoogle,
  loginWithMicrosoft,
  forgotPassword,
  User,
} from "./../lib/auth";
import { PrivacyPolicyModal } from "./PrivacyPolicyModal";
import {
  Home,
  TrendingUp,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Info,
  CheckCircle,
} from "lucide-react";

interface LoginSignupProps {
  onLogin: (user: User) => void;
  onBack: () => void;
}

const CAROUSEL_IMAGES = [
  "https://images.unsplash.com/photo-1679364297777-1db77b6199be?w=1080&q=80",
  "https://images.unsplash.com/photo-1594873604892-b599f847e859?w=1080&q=80",
  "https://images.unsplash.com/photo-1566908829550-e6551b00979b?w=1080&q=80",
  "https://images.unsplash.com/photo-1705321963943-de94bb3f0dd3?w=1080&q=80",
];

const GOOGLE_CONFIGURED = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
const MICROSOFT_CONFIGURED = !!import.meta.env.VITE_MICROSOFT_CLIENT_ID;

export function LoginSignup({ onLogin, onBack }: LoginSignupProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState<
    "email" | "google" | "microsoft" | null
  >(null);
  const [imgIndex, setImgIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotLink, setForgotLink] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    intervalRef.current = setInterval(
      () => setImgIndex((p) => (p + 1) % CAROUSEL_IMAGES.length),
      4000
    );
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const clear = () => { setError(""); setInfo(""); };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): string => {
    if (!email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
    if (!password) return "Password is required";
    if (!isLogin) {
      if (!name.trim() || name.trim().length < 2)
        return "Enter your full name (at least 2 characters)";
      if (password.length < 8)
        return "Password must be at least 8 characters";
      if (password !== confirm) return "Passwords do not match";
    }
    return "";
  };

  // ── Email submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading("email");
    try {
      const user = isLogin
        ? await login(email.trim(), password)
        : await register(name.trim(), email.trim(), password);
      onLogin(user);
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  // ── Forgot Password ─────────────────────────────────────────────────────────
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotLink(null);
    if (!forgotEmail.trim()) { setForgotError("Please enter your email address"); return; }
    setForgotLoading(true);
    try {
      const result = await forgotPassword(forgotEmail.trim());
      setForgotDone(true);
      setForgotLink(result.devResetUrl || null);
    } catch (e: any) {
      setForgotError(e.message || "Failed to send reset email");
    } finally {
      setForgotLoading(false);
    }
  };

  // ── Google ──────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    clear();
    if (!GOOGLE_CONFIGURED) {
      setInfo(
        "Google sign-in requires a one-time setup. Add VITE_GOOGLE_CLIENT_ID to your .env file. See OAUTH_SETUP.md for instructions."
      );
      return;
    }
    setLoading("google");
    try {
      const user = await loginWithGoogle();
      onLogin(user);
    } catch (e: any) {
      if (e.message === "GOOGLE_NOT_CONFIGURED") {
        setInfo("Google sign-in is not configured yet. Check OAUTH_SETUP.md.");
      } else {
        setError(e.message || "Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(null);
    }
  };

  // ── Microsoft ───────────────────────────────────────────────────────────────
  const handleMicrosoft = async () => {
    clear();
    if (!MICROSOFT_CONFIGURED) {
      setInfo(
        "Microsoft sign-in requires a one-time setup. Add VITE_MICROSOFT_CLIENT_ID to your .env file. See OAUTH_SETUP.md for instructions."
      );
      return;
    }
    setLoading("microsoft");
    try {
      const user = await loginWithMicrosoft();
      onLogin(user);
    } catch (e: any) {
      if (e.message === "MICROSOFT_NOT_CONFIGURED") {
        setInfo("Microsoft sign-in is not configured yet. Check OAUTH_SETUP.md.");
      } else {
        setError(e.message || "Microsoft sign-in failed. Please try again.");
      }
    } finally {
      setLoading(null);
    }
  };

  const handleComingSoon = (provider: string) => {
    clear();
    setInfo(`${provider} sign-in is coming soon. Use email/password, Google, or Microsoft for now.`);
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    clear();
    setPassword("");
    setConfirm("");
  };

  const anyLoading = loading !== null;

  return (
    <div className="min-h-screen flex">
      {/* ── Left: Form ───────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 relative bg-background">
        <Button
          variant="ghost"
          onClick={onBack}
          className="absolute top-4 left-4 gap-2"
          disabled={anyLoading}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>

        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-red-800 rounded-xl blur-md opacity-50" />
                <div className="relative bg-gradient-to-br from-red-600 to-red-800 p-3 rounded-xl shadow-xl">
                  <Home className="w-8 h-8 text-white" />
                  <TrendingUp className="w-4 h-4 text-white absolute -bottom-1 -right-1" />
                </div>
              </div>
              <div className="flex items-baseline leading-none">
                <span className="text-4xl font-bold text-red-600">BRO</span>
                <span className="text-4xl">kar</span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                {isLogin
                  ? "Sign in to access your property predictions"
                  : "Join BROkar to start predicting property values"}
              </p>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Info banner */}
          {info && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{info}</span>
            </div>
          )}

          {/* Social buttons */}
          <div className="space-y-2.5">
            {/* Google */}
            <Button
              variant="outline"
              className="w-full gap-2 h-10 relative"
              onClick={handleGoogle}
              disabled={anyLoading}
            >
              {loading === "google" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>Continue with Google</span>
              {!GOOGLE_CONFIGURED && (
                <span className="absolute right-3 text-xs text-muted-foreground">
                  Setup required
                </span>
              )}
            </Button>

            {/* Microsoft */}
            <Button
              variant="outline"
              className="w-full gap-2 h-10 relative"
              onClick={handleMicrosoft}
              disabled={anyLoading}
            >
              {loading === "microsoft" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#f25022" d="M0 0h11.377v11.372H0z" />
                  <path fill="#00a4ef" d="M12.623 0H24v11.372H12.623z" />
                  <path fill="#7fba00" d="M0 12.628h11.377V24H0z" />
                  <path fill="#ffb900" d="M12.623 12.628H24V24H12.623z" />
                </svg>
              )}
              <span>Continue with Microsoft</span>
              {!MICROSOFT_CONFIGURED && (
                <span className="absolute right-3 text-xs text-muted-foreground">
                  Setup required
                </span>
              )}
            </Button>

            {/* Facebook */}
            <Button
              variant="outline"
              className="w-full gap-2 h-10 relative"
              onClick={() => handleComingSoon("Facebook")}
              disabled={anyLoading}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>Continue with Facebook</span>
              <span className="absolute right-3 text-xs text-muted-foreground">Coming soon</span>
            </Button>

            {/* Apple */}
            <Button
              variant="outline"
              className="w-full gap-2 h-10 relative"
              onClick={() => handleComingSoon("Apple")}
              disabled={anyLoading}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              <span>Continue with Apple</span>
              <span className="absolute right-3 text-xs text-muted-foreground">Coming soon</span>
            </Button>
          </div>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
              Or continue with email
            </span>
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Aanchal Singh"
                    value={name}
                    onChange={(e) => { setName(e.target.value); clear(); }}
                    className="pl-10"
                    autoComplete="name"
                    disabled={anyLoading}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clear(); }}
                  className="pl-10"
                  autoComplete="email"
                  disabled={anyLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clear(); }}
                  className="pl-10 pr-10"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  disabled={anyLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); clear(); }}
                    className="pl-10 pr-10"
                    autoComplete="new-password"
                    disabled={anyLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm && password && (
                  <p className={`text-xs ${confirm === password ? "text-green-600" : "text-red-600"}`}>
                    {confirm === password ? "Passwords match ✓" : "Passwords do not match"}
                  </p>
                )}
              </div>
            )}

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  Remember me
                </label>
                <button type="button" className="text-sm text-red-600 hover:text-red-700" onClick={() => { setShowForgot(true); setForgotDone(false); setForgotError(""); setForgotEmail(email); }}>
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 h-10"
              disabled={anyLoading}
            >
              {loading === "email" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isLogin ? "Signing in…" : "Creating account…"}
                </span>
              ) : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <Separator />

          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            </span>
            <button
              onClick={switchMode}
              className="text-red-600 hover:text-red-700 font-medium"
              disabled={anyLoading}
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to BROkar's{" "}
            <button className="underline hover:text-foreground">Terms</button>{" "}
            and{" "}
            <button className="underline hover:text-foreground" onClick={() => setShowPrivacy(true)}>Privacy Policy</button>
          </p>
        </div>
      </div>

      {/* ── Forgot Password Modal ───────────────────── */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl">
                <Mail className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Reset Password</h2>
                <p className="text-sm text-muted-foreground">We'll email you a reset link</p>
              </div>
            </div>
            {forgotDone ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
                <p className="font-semibold text-green-600">Reset link sent!</p>
                <p className="text-sm text-muted-foreground">Check your inbox for instructions. If you don't see it, check your spam folder.</p>
                {forgotLink && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-left text-xs text-slate-700 dark:text-slate-300 break-words">
                    <p className="font-medium">Dev reset link:</p>
                    <a href={forgotLink} target="_blank" rel="noreferrer" className="text-red-600 hover:underline break-all">{forgotLink}</a>
                  </div>
                )}
                <Button className="mt-2 bg-red-600 hover:bg-red-700" onClick={() => setShowForgot(false)}>Back to Sign In</Button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" className="pl-10" required />
                  </div>
                </div>
                {forgotError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{forgotError}</div>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForgot(false)} disabled={forgotLoading}>Cancel</Button>
                  <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700" disabled={forgotLoading}>
                    {forgotLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : "Send Reset Link"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Privacy Policy Modal ─────────────────────── */}
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}

      {/* ── Right: Carousel ──────────────────────────── */}
      <div className="hidden lg:block flex-1 relative overflow-hidden bg-gradient-to-br from-red-600 to-red-800">
        {CAROUSEL_IMAGES.map((src, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === imgIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <ImageWithFallback
              src={src}
              alt={`Property ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-10 text-white">
          <h3 className="text-2xl font-semibold text-white mb-2">
            Find Your Dream Property
          </h3>
          <p className="text-white/85 max-w-sm">
            Predict future values and make informed investment decisions with
            AI-powered insights.
          </p>
          <div className="flex gap-2 mt-6">
            {CAROUSEL_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === imgIndex ? "bg-white w-8" : "bg-white/50 w-2"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

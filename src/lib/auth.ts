// ─── Types ───────────────────────────────────────────────────────────────────

import { api } from "./api";

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  city?: string;
  avatar?: string;
  joinDate: string;
  provider?: "email" | "google" | "microsoft";
}

export interface UserSettings {
  emailNotifications: boolean;
  priceAlerts: boolean;
  weeklyDigest: boolean;
  newsletterOptIn: boolean;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  USER: "brokar_user",
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
};

// ─── Persist helpers ──────────────────────────────────────────────────────────

export function saveUser(user: User): void {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(KEYS.USER);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function clearUser(): void {
  localStorage.removeItem(KEYS.USER);
  localStorage.removeItem(KEYS.ACCESS_TOKEN);
  localStorage.removeItem(KEYS.REFRESH_TOKEN);
  localStorage.removeItem("brokar_access_token");
  localStorage.removeItem("brokar_refresh_token");
}

export function isAuthenticated(): boolean {
  return !!loadUser();
}

export function saveTokens(access: string, refresh: string): void {
  localStorage.setItem(KEYS.ACCESS_TOKEN, access);
  localStorage.setItem(KEYS.REFRESH_TOKEN, refresh);
  localStorage.setItem("brokar_access_token", access);
  localStorage.setItem("brokar_refresh_token", refresh);
}

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(KEYS.ACCESS_TOKEN) ||
    localStorage.getItem("brokar_access_token")
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeAvatar = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

const makeJoinDate = () =>
  new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

export const apiUrl = () =>
  import.meta.env.VITE_API_URL || "http://127.0.0.1:3001/api";

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
  clearUser();
}

function isNetworkError(error: any): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof TypeError) return true;
  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("timeout") ||
    message.includes("network")
  );
}

// ─── Authenticated fetch helper ───────────────────────────────────────────────

export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${apiUrl()}${path}`, { ...options, headers });
}

// ─── Register ─────────────────────────────────────────────────────────────────

async function parseJsonOrText(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function register(name: string, email: string, password: string): Promise<User> {
  try {
    const res = await fetch(`${apiUrl()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await parseJsonOrText(res);
    if (res.ok && data) {
      saveTokens(data.accessToken, data.refreshToken);
      const user: User = {
        id: data.user.id,
        name: data.user.name,
        username: data.user.username,
        email: data.user.email,
        avatar: data.user.avatar || makeAvatar(email),
        joinDate: makeJoinDate(),
        provider: "email",
      };
      saveUser(user);
      return user;
    }
    throw new Error(data?.error || data?.message || "Registration failed");
  } catch (e: any) {
    if (!isNetworkError(e)) throw e;
    const existing = loadUser();
    if (existing?.email === email) throw new Error("An account with this email already exists");
    const user: User = { id: `local_${Date.now()}`, name, email, avatar: makeAvatar(email), joinDate: makeJoinDate(), provider: "email" };
    saveUser(user);
    return user;
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<User> {
  try {
    const res = await fetch(`${apiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await parseJsonOrText(res);
    if (res.ok && data) {
      saveTokens(data.accessToken, data.refreshToken);
      const prev = loadUser();
      const user: User = {
        id: data.user.id,
        name: data.user.name,
        username: data.user.username,
        email: data.user.email,
        avatar: data.user.avatar || prev?.avatar || makeAvatar(email),
        phone: prev?.phone,
        city: prev?.city,
        joinDate: prev?.joinDate || makeJoinDate(),
        provider: "email",
      };
      saveUser(user);
      return user;
    }
    throw new Error(data?.error || data?.message || "Invalid credentials");
  } catch (e: any) {
    if (!isNetworkError(e)) throw e;
    throw new Error("Unable to reach the server. Please try again later.");
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<{ message: string; devResetUrl?: string }> {
  const res = await fetch(`${apiUrl()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await parseJsonOrText(res);
  if (!res.ok) throw new Error(data?.error || data?.message || "Failed to send reset email");
  return data;
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(token: string, email: string, newPassword: string): Promise<void> {
  const res = await fetch(`${apiUrl()}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, email, newPassword }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await parseJsonOrText(res);
  if (!res.ok) throw new Error(data?.error || data?.message || "Failed to reset password");
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

export function loginWithGoogle(): Promise<User> {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) { reject(new Error("GOOGLE_NOT_CONFIGURED")); return; }

    const loadGSI = (): Promise<void> =>
      new Promise((res) => {
        if ((window as any).google?.accounts) { res(); return; }
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = () => res();
        document.head.appendChild(script);
      });

    loadGSI().then(() => {
      (window as any).google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          if (!response.credential) { reject(new Error("Google sign-in was cancelled")); return; }
          const parts = response.credential.split(".");
          const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
          const user: User = { id: `google_${payload.sub}`, name: payload.name, email: payload.email, avatar: payload.picture || makeAvatar(payload.email), joinDate: makeJoinDate(), provider: "google" };
          saveUser(user);
          resolve(user);
        },
      });

      (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          let div = document.getElementById("__g_btn");
          if (!div) { div = document.createElement("div"); div.id = "__g_btn"; div.style.display = "none"; document.body.appendChild(div); }
          (window as any).google.accounts.id.renderButton(div, { theme: "outline", size: "large" });
          const btn = div.querySelector<HTMLElement>("[role=button]");
          if (btn) btn.click();
        }
      });
    });
  });
}

// ─── Microsoft OAuth ──────────────────────────────────────────────────────────

export function loginWithMicrosoft(): Promise<User> {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) { reject(new Error("MICROSOFT_NOT_CONFIGURED")); return; }

    const redirectUri = window.location.origin;
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid profile email User.Read&response_mode=fragment&state=ms_login_${Date.now()}`;

    const popup = window.open(authUrl, "ms_login", "width=520,height=620,left=300,top=80");
    if (!popup) { reject(new Error("Popup was blocked. Please allow popups for this site and try again.")); return; }

    const timer = setInterval(() => {
      try {
        if (popup.closed) { clearInterval(timer); reject(new Error("Microsoft sign-in was cancelled")); return; }
        const url = popup.location.href;
        if (url.includes("access_token=")) {
          clearInterval(timer); popup.close();
          const hash = url.split("#")[1] || "";
          const params = new URLSearchParams(hash);
          const accessToken = params.get("access_token");
          if (!accessToken) { reject(new Error("Failed to retrieve access token from Microsoft")); return; }
          fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${accessToken}` } })
            .then((r) => r.json())
            .then((profile) => {
              const email = profile.mail || profile.userPrincipalName || "";
              const user: User = { id: `ms_${profile.id}`, name: profile.displayName || email, email, avatar: makeAvatar(profile.id), joinDate: makeJoinDate(), provider: "microsoft" };
              saveUser(user);
              resolve(user);
            })
            .catch(() => reject(new Error("Failed to fetch your Microsoft profile")));
        }
      } catch { /* cross-origin */ }
    }, 500);

    setTimeout(() => { clearInterval(timer); if (!popup.closed) popup.close(); reject(new Error("Microsoft sign-in timed out")); }, 300_000);
  });
}

// ─── Update profile ───────────────────────────────────────────────────────────

export async function updateProfile(updates: Partial<User>): Promise<User> {
  const current = loadUser();
  if (!current) throw new Error("Not logged in");
  const updated: User = { ...current, ...updates };

  try {
    await api.patch("/users/me", {
      name: updates.name,
      phone: updates.phone,
      city: updates.city,
      username: updates.username,
      avatar: updates.avatar,
    });
  } catch { /* Local save still works */ }

  saveUser(updated);
  return updated;
}

// ─── User Settings API ────────────────────────────────────────────────────────

export async function fetchUserSettings(): Promise<UserSettings> {
  try {
    const { data } = await api.get("/users/me/settings");
    return data;
  } catch { /* fallback */ }
  return { emailNotifications: true, priceAlerts: true, weeklyDigest: false, newsletterOptIn: false };
}

export async function saveUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const { data } = await api.patch("/users/me/settings", settings);
  return data;
}

// ─── Favorites API ────────────────────────────────────────────────────────────

export async function fetchFavoriteIds(): Promise<string[]> {
  try {
    const { data } = await api.get<string[]>("/users/me/favorite-ids");
    return data;
  } catch { /* ignore */ }
  return [];
}

export async function addFavorite(propertyId: string): Promise<void> {
  await api.post(`/users/me/favorites/${propertyId}`);
}

export async function removeFavorite(propertyId: string): Promise<void> {
  await api.delete(`/users/me/favorites/${propertyId}`);
}

// ─── Change password ──────────────────────────────────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data } = await api.post("/users/me/change-password", { currentPassword, newPassword });
  if (data?.error) throw new Error(data.error || "Failed to change password");
}

// ─── Delete account ───────────────────────────────────────────────────────────

export async function deleteAccount(): Promise<void> {
  await api.delete("/users/me");
  clearUser();
}

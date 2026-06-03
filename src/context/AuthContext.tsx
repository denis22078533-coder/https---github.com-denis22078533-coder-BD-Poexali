import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AuthState {
  token: string | null;
  email: string | null;
  balance: number;
}

interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  companyName?: string;
}

interface AuthContextType extends AuthState {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_BASE || "";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
  return data as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem("auth_token");
    const email = localStorage.getItem("auth_email");
    return { token, email, balance: 0 };
  });

  const isAuthenticated = !!state.token;

  const saveToken = (token: string, email: string) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_email", email);
    setState((prev) => ({ ...prev, token, email }));
  };

  const clearToken = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_email");
    setState({ token: null, email: null, balance: 0 });
  };

  async function refreshBalanceAfterLogin(token: string) {
    try {
      const res = await request<{ email: string; balance: number }>("/auth/me", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      setState((prev) => ({ ...prev, balance: res.balance }));
    } catch {
      // Если не получилось — ок, просто будет 0
    }
  }

  // --- Валидация ---
  const validateEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return "Минимум 8 символов";
    if (!/[A-Z]/.test(password)) return "Нужна хотя бы одна заглавная буква";
    if (!/[a-z]/.test(password)) return "Нужна хотя бы одна строчная буква";
    if (!/[0-9]/.test(password)) return "Нужна хотя бы одна цифра";
    return null;
  };

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!validateEmail(email)) return { success: false, error: "Некорректный email" };
    if (!password) return { success: false, error: "Введите пароль" };
    
    try {
      const res = await request<{ access_token: string; token_type: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveToken(res.access_token, email);
      await refreshBalanceAfterLogin(res.access_token);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка входа";
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    // Валидация
    if (!validateEmail(data.email))
      return { success: false, error: "Некорректный email" };
    
    const passwordError = validatePassword(data.password);
    if (passwordError)
      return { success: false, error: `Пароль: ${passwordError}` };
    
    if (data.password !== data.confirmPassword)
      return { success: false, error: "Пароли не совпадают" };

    // Подготовка тела запроса
    const body: Record<string, unknown> = {
      email: data.email,
      password: data.password,
    };
    if (data.companyName) body.company_name = data.companyName;

    // Привязка гостевой сессии
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : undefined;
    };
    const sessionId = getCookie("session_id");
    if (sessionId) body.session_id = sessionId;

    try {
      const res = await request<{ access_token: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      saveToken(res.access_token, data.email);
      await refreshBalanceAfterLogin(res.access_token);
      document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка регистрации";
      // Преобразуем понятные ошибки
      if (message.includes("409") || message.toLowerCase().includes("already exists") || message.toLowerCase().includes("already registered"))
        return { success: false, error: "Этот email уже зарегистрирован" };
      return { success: false, error: message };
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!state.token) return;
    try {
      const res = await request<{ email: string; balance: number }>("/auth/me", {
        headers: { Authorization: `Bearer ${state.token}`, "Content-Type": "application/json" },
      });
      setState((prev) => ({ ...prev, balance: res.balance }));
    } catch {
      // Если токен протух — разлогиниваем
      clearToken();
    }
  }, [state.token]);

  const logout = useCallback(() => {
    clearToken();
  }, []);

  // При монтировании проверяем, жив ли токен
  useEffect(() => {
    if (state.token) {
      refreshBalance();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token: state.token,
        email: state.email,
        balance: state.balance,
        isAuthenticated,
        login,
        register,
        logout,
        refreshBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
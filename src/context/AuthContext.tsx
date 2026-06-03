import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface AuthState {
  token: string | null;
  email: string | null;
  balance: number;
}

interface AuthContextType extends AuthState {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await request<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    saveToken(res.access_token, email);
    // После логина получаем баланс
    await refreshBalanceAfterLogin(res.access_token);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    // Читаем session_id из куки (если был гостевой режим)
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[2]) : undefined;
    };
    const sessionId = getCookie("session_id");
    const body: Record<string, unknown> = { email, password };
    if (sessionId) {
      body.session_id = sessionId;
    }
    const res = await request<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    saveToken(res.access_token, email);
    // После регистрации сразу получаем баланс (должен быть с бонусом)
    await refreshBalanceAfterLogin(res.access_token);
    // Удаляем session_id из куки, т.к. гостевая сессия больше не нужна
    document.cookie = "session_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
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
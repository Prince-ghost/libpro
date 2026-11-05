"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // status: "loading" | "authenticated" | "anonymous" | "error" (the API could not be reached)
  const [state, setState] = useState({ status: "loading", user: null });

  // Ask the API once who is logged in. The cookie is HttpOnly, so the browser sends it for us.
  useEffect(() => {
    const controller = new AbortController();
    api("/api/auth/me", { signal: controller.signal })
      .then(({ data }) => setState({ status: "authenticated", user: data.user }))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState({ status: err?.status === 401 ? "anonymous" : "error", user: null });
      });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api("/api/auth/login", { method: "POST", body: { email, password } });
    setState({ status: "authenticated", user: data.user });
    return data.user;
  }, []);

  // The signed token from Google's button. The backend verifies it; we never trust the browser.
  const loginWithGoogle = useCallback(async (credential) => {
    const { data } = await api("/api/auth/google", { method: "POST", body: { credential } });
    setState({ status: "authenticated", user: data.user });
    return data.user;
  }, []);

  // Registering does not log you in on the server, so the forms call login() afterwards.
  const register = useCallback(async ({ name, email, password }) => {
    await api("/api/auth/register", { method: "POST", body: { name, email, password } });
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    // Stop Google from silently picking the same account again on the next visit.
    window.google?.accounts?.id?.disableAutoSelect?.();
    setState({ status: "anonymous", user: null });
  }, []);

  // After the server confirms a change (for example a new name), the screen shows it straight away.
  const updateUser = useCallback((changes) => {
    setState((prev) =>
      prev.status === "authenticated" ? { ...prev, user: { ...prev.user, ...changes } } : prev
    );
  }, []);

  const value = useMemo(
    () => ({ ...state, login, loginWithGoogle, register, logout, updateUser }),
    [state, login, loginWithGoogle, register, logout, updateUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
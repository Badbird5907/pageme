"use client";
import { env } from "@/env";
import { useCallback, useEffect, useState } from "react";

export const login = async (username: string, pin: string) => {
  const response = await fetch(`${env.NEXT_PUBLIC_CONVEX_SITE_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ username, pin }),
  });
  if (!response.ok) {
    throw new Error("Failed to login");
  }
  const data = await response.json() as { token: string; isAdmin?: boolean };
  const token: string = data.token;

  await window.cookieStore.set("token", token);
  await window.cookieStore.set("username", username);
  await window.cookieStore.set("admin", data.isAdmin === true ? "true" : "false");
  return true;
};


export const logout = async () => {
  await Promise.all([
    window.cookieStore.delete("token"),
    window.cookieStore.delete("username"),
    window.cookieStore.delete("admin"),
  ]);
  return true;
};

export const isAuthenticated = async () => {
  const token = await window.cookieStore.get("token");
  const username = await window.cookieStore.get("username");
  if (!token || !username) {
    return false;
  }
  return true;
};

export const useAuth = () => {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const refresh = useCallback(async () => {
    const [tokenCookie, usernameCookie, adminCookie] = await Promise.all([
      window.cookieStore.get("token"),
      window.cookieStore.get("username"),
      window.cookieStore.get("admin"),
    ]);

    const isLoggedIn = Boolean(tokenCookie?.value && usernameCookie?.value);
    setAuthenticated(isLoggedIn);
    setUsername(usernameCookie?.value ?? null);
    setIsAdmin(isLoggedIn && adminCookie?.value === "true");
    return isLoggedIn;
  }, []);

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => {
      void refresh();
    }, 0);

    const handleCookieChange = () => {
      void refresh();
    };

    window.cookieStore.addEventListener("change", handleCookieChange);
    return () => {
      window.clearTimeout(initialRefreshId);
      window.cookieStore.removeEventListener("change", handleCookieChange);
    };
  }, [refresh]);

  const loginAndRefresh = useCallback(
    async (name: string, pin: string) => {
      await login(name, pin);
      await refresh();
      return true;
    },
    [refresh]
  );

  const logoutAndRefresh = useCallback(async () => {
    await logout();
    await refresh();
    return true;
  }, [refresh]);

  return {
    isLoading: authenticated === null,
    isAuthenticated: authenticated === true,
    username,
    isAdmin,
    refresh,
    login: loginAndRefresh,
    logout: logoutAndRefresh,
  };
};
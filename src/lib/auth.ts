"use client";

import { env } from "@/env";
import { useCallback, useEffect, useState } from "react";

type CookieValue = {
  name: string;
  value: string;
};

function readDocumentCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);

  return value ? decodeURIComponent(value) : null;
}

async function getCookie(name: string): Promise<CookieValue | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if ("cookieStore" in window) {
    const cookie = await window.cookieStore.get(name);
    return cookie ? { name: cookie.name ?? name, value: cookie.value ?? "" } : null;
  }

  const value = readDocumentCookie(name);
  return value === null ? null : { name, value };
}

async function setCookie(name: string, value: string) {
  if ("cookieStore" in window) {
    await window.cookieStore.set(name, value);
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
}

async function deleteCookie(name: string) {
  if ("cookieStore" in window) {
    await window.cookieStore.delete(name);
    return;
  }

  document.cookie = `${name}=; Max-Age=0; path=/`;
}

export const login = async (username: string, pin: string) => {
  const response = await fetch(`${env.NEXT_PUBLIC_CONVEX_SITE_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ username, pin }),
  });

  if (!response.ok) {
    throw new Error("Failed to login");
  }

  const data = (await response.json()) as { isAdmin?: boolean; token: string };

  await Promise.all([
    setCookie("token", data.token),
    setCookie("username", username),
    setCookie("admin", data.isAdmin === true ? "true" : "false"),
  ]);

  return true;
};

export const logout = async () => {
  await Promise.all([
    deleteCookie("token"),
    deleteCookie("username"),
    deleteCookie("admin"),
  ]);
  return true;
};

export const isAuthenticated = async () => {
  const token = await getCookie("token");
  return token !== null;
};

export const useAuth = () => {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchAccessToken = useCallback(async () => {
    const token = await getCookie("token");
    return token?.value ?? null;
  }, []);

  const refresh = useCallback(async () => {
    const [tokenCookie, usernameCookie, adminCookie] = await Promise.all([
      getCookie("token"),
      getCookie("username"),
      getCookie("admin"),
    ]);

    const isLoggedIn = Boolean(tokenCookie?.value);
    setAuthenticated(isLoggedIn);
    setUsername(usernameCookie?.value ?? null);
    setIsAdmin(isLoggedIn && adminCookie?.value === "true");

    return isLoggedIn;
  }, []);

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => {
      void refresh();
    }, 0);

    if (!("cookieStore" in window)) {
      return () => {
        window.clearTimeout(initialRefreshId);
      };
    }

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
    [refresh],
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
    fetchAccessToken,
    login: loginAndRefresh,
    logout: logoutAndRefresh,
  };
};

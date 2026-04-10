"use client";

import { env } from "@/env";
import { useCallback, useEffect, useState } from "react";

type CookieValue = {
  name: string;
  value: string;
};

type CookieOptions = {
  expires?: Date;
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

async function setCookie(name: string, value: string, options?: CookieOptions) {
  if ("cookieStore" in window) {
    const expires =
      options?.expires instanceof Date ? options.expires.getTime() : undefined;

    await window.cookieStore.set({
      name,
      value,
      expires,
      path: "/",
    });
    return;
  }

  const expires = options?.expires ? `; Expires=${options.expires.toUTCString()}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
}

async function deleteCookie(name: string) {
  if ("cookieStore" in window) {
    await window.cookieStore.delete(name);
    return;
  }

  document.cookie = `${name}=; Max-Age=0; path=/`;
}

function parseJwtExpirationMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as {
      exp?: unknown;
    };
    if (typeof payload.exp !== "number") {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const expirationMs = parseJwtExpirationMs(token);
  if (!expirationMs) {
    return true;
  }
  return Date.now() >= expirationMs;
}

export const login = async (username: string, pin: string) => {
  const response = await fetch(`${env.NEXT_PUBLIC_CONVEX_SITE_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ username, pin }),
  });

  if (!response.ok) {
    throw new Error("Failed to login");
  }

  const data = (await response.json()) as {
    expiresAt?: number;
    isAdmin?: boolean;
    token: string;
  };

  const tokenExpiryMs = parseJwtExpirationMs(data.token) ?? data.expiresAt ?? null;
  const tokenExpiry = tokenExpiryMs ? new Date(tokenExpiryMs) : undefined;

  await Promise.all([
    setCookie("token", data.token, { expires: tokenExpiry }),
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
  if (!token?.value) {
    return false;
  }
  return !isTokenExpired(token.value);
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

    const tokenValue = tokenCookie?.value ?? null;
    const hasValidToken = tokenValue !== null && !isTokenExpired(tokenValue);
    const isLoggedIn = hasValidToken;
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

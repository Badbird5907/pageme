"use node";

export const PAGEM_URL = "https://www.pagem.com";
export const PAGEM_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

type CookieSource = Headers;

export type PagemHttpResult = {
  bodyText: string;
  json: Record<string, unknown> | null;
  redirectedTo: string | null;
  response: Response;
  sessionCookie: string | null;
};

type PagemAjaxData = {
  error?: string;
  success?: boolean;
};

type PagemAjaxResponse = {
  data?: PagemAjaxData | null;
  errorHtml?: string;
  isError?: boolean;
  isRedirect?: boolean;
  redirectUrl?: string;
};

function toAbsoluteUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

function normalizeLocation(baseUrl: string, location: string | null) {
  if (!location) {
    return null;
  }

  return new URL(location, baseUrl).toString();
}

function getSetCookieHeader(headers: CookieSource) {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithSetCookie.getSetCookie === "function") {
    return headersWithSetCookie.getSetCookie();
  }

  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

export function extractSessionCookie(headers: CookieSource) {
  for (const headerValue of getSetCookieHeader(headers)) {
    const match = headerValue.match(/(?:^|;\s*)SESSION=([^;,\s]+)/);
    if (match) {
      return `SESSION=${match[1]}`;
    }
  }

  return null;
}

export function extractCsrf(html: string) {
  const hiddenInputMatch = html.match(
    /<input[^>]*name=["']_csrf["'][^>]*value=["']([^"']+)["']/i,
  );
  if (hiddenInputMatch) {
    return hiddenInputMatch[1];
  }

  const metaMatch = html.match(
    /<meta[^>]*id=["']csrf["'][^>]*data-value=["']([^"']+)["']/i,
  );
  return metaMatch?.[1] ?? null;
}

export function buildFormBody(formFields: Record<string, string | number>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(formFields)) {
    params.set(key, String(value));
  }

  return params.toString();
}

function isSecurePath(url: string | null) {
  return url !== null && new URL(url).pathname.startsWith("/secure/");
}

export function isLoginSuccess(response: Response, bodyText: string) {
  const location = response.headers.get("location");
  const finalUrl = response.url || null;

  if ((response.status === 302 || response.status === 303) && location) {
    return new URL(location, PAGEM_URL).pathname.startsWith("/secure/");
  }

  if (response.ok && isSecurePath(finalUrl)) {
    return true;
  }

  return response.ok && !bodyText.includes('id="loginForm"') && !bodyText.includes('id="loginPage"');
}

export function isAuthExpired(response: Response, bodyText: string) {
  const ajaxResponse = asAjaxResponse(parseJsonBody(bodyText));

  if (response.status === 401 || response.status === 403) {
    return true;
  }

  if (
    ajaxResponse?.isRedirect === true &&
    typeof ajaxResponse.redirectUrl === "string" &&
    new URL(ajaxResponse.redirectUrl, PAGEM_URL).pathname.startsWith("/login")
  ) {
    return true;
  }

  const location = response.headers.get("location");
  if ((response.status === 302 || response.status === 303) && location) {
    return new URL(location, PAGEM_URL).pathname.startsWith("/login");
  }

  return (
    bodyText.includes('id="loginForm"') ||
    bodyText.includes('id="loginPage"') ||
    bodyText.includes("Application Login Page")
  );
}

function browserHeaders(baseUrl: string, path: string, sessionCookie?: string) {
  const headers = new Headers({
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "User-Agent": PAGEM_USER_AGENT,
  });

  if (sessionCookie) {
    headers.set("Cookie", sessionCookie);
  }

  if (path !== "/login") {
    headers.set("Origin", baseUrl);
    headers.set("Referer", toAbsoluteUrl(baseUrl, "/secure/dashboard"));
  }

  return headers;
}

function appendCookie(headers: Headers, cookieName: string, cookieValue: string) {
  const existing = headers.get("Cookie");
  const nextCookie = `${cookieName}=${cookieValue}`;
  headers.set("Cookie", existing ? `${existing}; ${nextCookie}` : nextCookie);
}

function ajaxHeaders(baseUrl: string, path: string, csrfToken: string, sessionCookie: string) {
  const headers = browserHeaders(baseUrl, path, sessionCookie);
  headers.set("Accept", "application/json, text/javascript, */*; q=0.01");
  headers.set("X-CSRF-Token", csrfToken);
  headers.set("X-Requested-With", "XMLHttpRequest");
  return headers;
}

async function readBody(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parseJsonBody(bodyText: string): Record<string, unknown> | null {
  try {
    return JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asAjaxResponse(json: Record<string, unknown> | null): PagemAjaxResponse | null {
  return json as PagemAjaxResponse | null;
}

export function getAjaxError(bodyText: string) {
  const ajaxResponse = asAjaxResponse(parseJsonBody(bodyText));
  const dataError = ajaxResponse?.data?.error;

  if (dataError) {
    return dataError;
  }

  const htmlError = ajaxResponse?.errorHtml;
  if (htmlError) {
    return htmlError.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return null;
}

export function isAjaxSuccess(bodyText: string) {
  const ajaxResponse = asAjaxResponse(parseJsonBody(bodyText));
  return ajaxResponse?.data?.success === true;
}

export async function fetchLoginPage(baseUrl: string) {
  const response = await fetch(toAbsoluteUrl(baseUrl, "/login"), {
    headers: browserHeaders(baseUrl, "/login"),
    method: "GET",
    redirect: "follow",
  });
  const bodyText = await readBody(response);

  return {
    bodyText,
    json: parseJsonBody(bodyText),
    csrfToken: extractCsrf(bodyText),
    redirectedTo: response.redirected ? response.url : null,
    response,
    sessionCookie: extractSessionCookie(response.headers),
  };
}

export async function fetchAuthenticatedPage(args: {
  baseUrl: string;
  path: string;
  sessionCookie: string;
}) {
  const response = await fetch(toAbsoluteUrl(args.baseUrl, args.path), {
    headers: browserHeaders(args.baseUrl, args.path, args.sessionCookie),
    method: "GET",
    redirect: "follow",
  });
  const bodyText = await readBody(response);

  return {
    bodyText,
    csrfToken: extractCsrf(bodyText),
    json: parseJsonBody(bodyText),
    redirectedTo: response.redirected ? response.url : null,
    response,
    sessionCookie: extractSessionCookie(response.headers),
  };
}

export async function postLogin(args: {
  baseUrl: string;
  csrfToken: string;
  password: string;
  sessionCookie: string;
  username: string;
}) {
  const headers = browserHeaders(args.baseUrl, "/login", args.sessionCookie);
  appendCookie(headers, "username", args.username);
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  headers.set("Origin", args.baseUrl);
  headers.set("Referer", toAbsoluteUrl(args.baseUrl, "/login"));
  headers.set("X-CSRF-Token", args.csrfToken);

  const response = await fetch(toAbsoluteUrl(args.baseUrl, "/login"), {
    body: buildFormBody({
      _csrf: args.csrfToken,
      password: args.password,
      username: args.username,
    }),
    headers,
    method: "POST",
    redirect: "manual",
  });
  const bodyText = await readBody(response);

  return {
    bodyText,
    json: parseJsonBody(bodyText),
    redirectedTo: normalizeLocation(args.baseUrl, response.headers.get("location")),
    response,
    sessionCookie: extractSessionCookie(response.headers),
  } satisfies PagemHttpResult;
}

export async function postSendPage(args: {
  baseUrl: string;
  body: string;
  csrfToken: string;
  groupPageType: string;
  pageeDirectoryEntryId: number;
  sessionCookie: string;
}) {
  const headers = ajaxHeaders(
    args.baseUrl,
    "/secure/pagees/sendPage",
    args.csrfToken,
    args.sessionCookie,
  );
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  headers.set("Origin", args.baseUrl);
  headers.set("Referer", toAbsoluteUrl(args.baseUrl, "/secure/dashboard"));

  const response = await fetch(toAbsoluteUrl(args.baseUrl, "/secure/pagees/sendPage"), {
    body: buildFormBody({
      _csrf: args.csrfToken,
      body: args.body,
      groupPageType: args.groupPageType,
      pageeDirectoryEntryId: args.pageeDirectoryEntryId,
    }),
    headers,
    method: "POST",
    redirect: "manual",
  });
  const bodyText = await readBody(response);

  return {
    bodyText,
    json: parseJsonBody(bodyText),
    redirectedTo: normalizeLocation(args.baseUrl, response.headers.get("location")),
    response,
    sessionCookie: extractSessionCookie(response.headers),
  } satisfies PagemHttpResult;
}

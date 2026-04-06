"use node";

import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import {
  PAGEM_URL,
  fetchAuthenticatedPage,
  fetchLoginPage,
  getAjaxError,
  isAuthExpired,
  isAjaxSuccess,
  isLoginSuccess,
  postLogin,
  postSendPage,
} from "./index";
import { env } from "../env";

const LEASE_DURATION_MS = 10_000;
const LEASE_POLL_INTERVAL_MS = 250;
const LEASE_WAIT_TIMEOUT_MS = 10_000;
const MAX_CHARS_BEFORE_TRUNCATE = 232; // idk found by brute force

export const sendPageArgs = {
  body: v.string(),
  // groupPageType: v.string(),
  // pageeDirectoryEntryId: v.number(),
};

export const sendPageReturns = v.object({
  redirectedTo: v.union(v.string(), v.null()),
  reauthenticated: v.boolean(),
  status: v.number(),
});

type RuntimeConfig = {
  baseUrl: string;
  password: string;
  username: string;
};

type SessionSnapshot = {
  csrfToken: string;
  sessionCookie: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRuntimeConfig(): RuntimeConfig {
  const username = env.PAGEM_USERNAME;
  const password = env.PAGEM_PASSWORD;

  if (!username) {
    throw new Error("Missing PAGEM_USERNAME environment variable");
  }

  if (!password) {
    throw new Error("Missing PAGEM_PASSWORD environment variable");
  }

  return {
    baseUrl: env.PAGEM_BASE_URL ?? PAGEM_URL,
    password,
    username,
  };
}

function requireSessionSnapshot(state: {
  csrfToken: string | null;
  sessionCookie: string | null;
}) {
  if (!state.sessionCookie) {
    throw new Error("Pagem session cookie is unavailable");
  }

  if (!state.csrfToken) {
    throw new Error("Pagem CSRF token is unavailable");
  }

  return {
    csrfToken: state.csrfToken,
    sessionCookie: state.sessionCookie,
  } satisfies SessionSnapshot;
}

function hasActiveLease(state: {
  leaseExpiresAt: number | null;
  leaseId: string | null;
}) {
  return (
    state.leaseId !== null &&
    state.leaseExpiresAt !== null &&
    state.leaseExpiresAt > Date.now()
  );
}

function hasAuthenticatedSession(state: {
  csrfToken: string | null;
  sessionCookie: string | null;
  status: "anonymous" | "authenticated" | "invalid";
}) {
  return (
    state.status === "authenticated" &&
    state.sessionCookie !== null &&
    state.csrfToken !== null
  );
}

async function createAuthenticatedSession(
  ctx: ActionCtx,
  config: RuntimeConfig,
  leaseId: string,
) {
  const bootstrappedAt = Date.now();
  const loginPage = await fetchLoginPage(config.baseUrl);

  if (!loginPage.sessionCookie) {
    throw new Error("Pagem login bootstrap did not return a SESSION cookie");
  }

  if (!loginPage.csrfToken) {
    throw new Error("Pagem login bootstrap did not include a CSRF token");
  }

  await ctx.runMutation(internal.pagem.pagerState.markAnonymousBootstrap, {
    csrfToken: loginPage.csrfToken,
    leaseId,
    now: bootstrappedAt,
    sessionCookie: loginPage.sessionCookie,
  });

  const loginResponse = await postLogin({
    baseUrl: config.baseUrl,
    csrfToken: loginPage.csrfToken,
    password: config.password,
    sessionCookie: loginPage.sessionCookie,
    username: config.username,
  });

  if (!isLoginSuccess(loginResponse.response, loginResponse.bodyText)) {
    throw new Error("Pagem login failed");
  }

  const authenticatedPage = await fetchAuthenticatedPage({
    baseUrl: config.baseUrl,
    path: "/secure/dashboard",
    sessionCookie: loginResponse.sessionCookie ?? loginPage.sessionCookie,
  });
  if (isAuthExpired(authenticatedPage.response, authenticatedPage.bodyText)) {
    throw new Error("Pagem login did not produce an authenticated dashboard session");
  }

  if (!authenticatedPage.csrfToken) {
    throw new Error("Authenticated Pagem dashboard did not include a CSRF token");
  }

  const authenticatedAt = Date.now();
  const sessionCookie =
    authenticatedPage.sessionCookie ??
    loginResponse.sessionCookie ??
    loginPage.sessionCookie;

  return await ctx.runMutation(internal.pagem.pagerState.commitAuthenticatedSession, {
    csrfToken: authenticatedPage.csrfToken,
    leaseId,
    now: authenticatedAt,
    sessionCookie,
  });
}

async function waitForSession(ctx: ActionCtx) {
  const deadline = Date.now() + LEASE_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const state = await ctx.runQuery(internal.pagem.pagerState.readDefaultState, {});
    if (state && hasAuthenticatedSession(state) && !hasActiveLease(state)) {
      return requireSessionSnapshot(state);
    }

    await sleep(LEASE_POLL_INTERVAL_MS);
  }

  return null;
}

async function ensureSession(ctx: ActionCtx, config: RuntimeConfig): Promise<SessionSnapshot> {
  const existingState = await ctx.runMutation(
    internal.pagem.pagerState.getOrCreateDefaultState,
    {},
  );

  if (hasAuthenticatedSession(existingState) && !hasActiveLease(existingState)) {
    return requireSessionSnapshot(existingState);
  }

  const firstLeaseId = randomUUID();
  const firstAttempt = await ctx.runMutation(
    internal.pagem.pagerState.tryAcquireRefreshLease,
    {
      leaseDurationMs: LEASE_DURATION_MS,
      leaseId: firstLeaseId,
      now: Date.now(),
    },
  );

  if (firstAttempt.acquired) {
    try {
      const authenticatedState = await createAuthenticatedSession(
        ctx,
        config,
        firstLeaseId,
      );
      return requireSessionSnapshot(authenticatedState);
    } catch (error) {
      await ctx.runMutation(internal.pagem.pagerState.releaseLease, {
        leaseId: firstLeaseId,
      });
      throw error;
    }
  }

  const waitedSession = await waitForSession(ctx);
  if (waitedSession) {
    return waitedSession;
  }

  const secondLeaseId = randomUUID();
  const secondAttempt = await ctx.runMutation(
    internal.pagem.pagerState.tryAcquireRefreshLease,
    {
      leaseDurationMs: LEASE_DURATION_MS,
      leaseId: secondLeaseId,
      now: Date.now(),
    },
  );

  if (!secondAttempt.acquired) {
    throw new Error("Timed out waiting for a usable Pagem session");
  }

  try {
    const authenticatedState = await createAuthenticatedSession(
      ctx,
      config,
      secondLeaseId,
    );
    return requireSessionSnapshot(authenticatedState);
  } catch (error) {
    await ctx.runMutation(internal.pagem.pagerState.releaseLease, {
      leaseId: secondLeaseId,
    });
    throw error;
  }
}

async function sendWithSession(
  ctx: ActionCtx,
  config: RuntimeConfig,
  session: SessionSnapshot,
  args: {
    body: string;
    // groupPageType: string;
    // pageeDirectoryEntryId: number;
  },
) {
  const authenticatedPage = await fetchAuthenticatedPage({
    baseUrl: config.baseUrl,
    path: "/secure/dashboard",
    sessionCookie: session.sessionCookie,
  });

  if (isAuthExpired(authenticatedPage.response, authenticatedPage.bodyText)) {
    return {
      bodyText: authenticatedPage.bodyText,
      json: authenticatedPage.json,
      redirectedTo: authenticatedPage.redirectedTo,
      response: authenticatedPage.response,
      sessionCookie: authenticatedPage.sessionCookie,
    };
  }

  if (!authenticatedPage.csrfToken) {
    throw new Error("Authenticated Pagem page did not include a CSRF token");
  }

  const refreshedCookie = authenticatedPage.sessionCookie ?? session.sessionCookie;

  await ctx.runMutation(internal.pagem.pagerState.refreshAuthenticatedCsrf, {
    csrfToken: authenticatedPage.csrfToken,
    now: Date.now(),
    sessionCookie: refreshedCookie,
  });

  const sendResult = await postSendPage({
    baseUrl: config.baseUrl,
    body: args.body,
    csrfToken: authenticatedPage.csrfToken,
    // groupPageType: args.groupPageType,
    // pageeDirectoryEntryId: args.pageeDirectoryEntryId,
    groupPageType: env.PAGEM_GROUP_PAGE_TYPE ?? "",
    pageeDirectoryEntryId: Number.parseInt(env.PAGEM_PAGE_DIRECTORY_ENTRY_ID ?? "0", 10),
    sessionCookie: refreshedCookie,
  });
  return sendResult;
}

export const sendPage = internalAction({
  args: sendPageArgs,
  returns: sendPageReturns,
  handler: async (ctx, args) => {
    const config = getRuntimeConfig();

    try {
      const initialSession = await ensureSession(ctx, config);
      let sendResult = await sendWithSession(ctx, config, initialSession, args);

      if (
        !isAuthExpired(sendResult.response, sendResult.bodyText) &&
        isAjaxSuccess(sendResult.bodyText)
      ) {
        await ctx.runMutation(internal.pagem.pagerState.recordSendSuccess, {
          now: Date.now(),
        });
        return {
          redirectedTo: sendResult.redirectedTo,
          reauthenticated: false,
          status: sendResult.response.status,
        };
      }

      if (!isAuthExpired(sendResult.response, sendResult.bodyText)) {
        const sendError = getAjaxError(sendResult.bodyText) ?? "Unable to send page.";
        throw new Error(`Pagem send failed: ${sendError}`);
      }

      await ctx.runMutation(internal.pagem.pagerState.invalidateSession, {
        now: Date.now(),
        reason: null,
      });

      const repairedSession = await ensureSession(ctx, config);
      sendResult = await sendWithSession(ctx, config, repairedSession, args);

      if (isAuthExpired(sendResult.response, sendResult.bodyText)) {
        const retryFailureDetail =
          `Pagem session repair failed after retry (status=${sendResult.response.status}, redirect=${sendResult.redirectedTo ?? "none"})`;
        await ctx.runMutation(internal.pagem.pagerState.invalidateSession, {
          now: Date.now(),
          reason: retryFailureDetail,
        });
        throw new Error(retryFailureDetail);
      }

      if (!isAjaxSuccess(sendResult.bodyText)) {
        const sendError = getAjaxError(sendResult.bodyText) ?? "Unable to send page.";
        throw new Error(`Pagem send failed: ${sendError}`);
      }

      await ctx.runMutation(internal.pagem.pagerState.recordSendSuccess, {
        now: Date.now(),
      });
      return {
        redirectedTo: sendResult.redirectedTo,
        reauthenticated: true,
        status: sendResult.response.status,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Pagem sendPage failure";
      console.log("failed", { message });
      await ctx.runMutation(internal.pagem.pagerState.recordFailure, {
        message,
        now: Date.now(),
      });
      throw error;
    }
  },
});

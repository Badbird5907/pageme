import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  query,
} from "./_generated/server";
import { requireUser } from "./auth";
import { paginationOptsValidator } from "convex/server";

const DEFAULT_PAGEM_STATE_KEY = "default";
const SEND_LEASE_DURATION_MS = 60_000;

const pageAttemptStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
);

const pageAttemptDocValidator = v.object({
  _id: v.id("pageHistory"),
  _creationTime: v.number(),
  fromUser: v.union(v.id("users"), v.null()),
  fromApiTokenName: v.optional(v.union(v.string(), v.null())),
  message: v.string(),
  createdAt: v.number(),
  status: v.optional(pageAttemptStatusValidator),
  startedAt: v.optional(v.union(v.number(), v.null())),
  finishedAt: v.optional(v.union(v.number(), v.null())),
  errorMessage: v.optional(v.union(v.string(), v.null())),
  resultStatus: v.optional(v.union(v.number(), v.null())),
  resultRedirectedTo: v.optional(v.union(v.string(), v.null())),
  resultReauthenticated: v.optional(v.union(v.boolean(), v.null())),
  leaseId: v.optional(v.union(v.string(), v.null())),
});

const nullablePageAttemptDocValidator = v.union(pageAttemptDocValidator, v.null());

const sendPageResultValidator = v.object({
  redirectedTo: v.union(v.string(), v.null()),
  reauthenticated: v.boolean(),
  status: v.number(),
});

type SendPageAccepted = {
  pageHistoryId: Id<"pageHistory">;
  status: "pending";
};

function hasActiveSendLease(
  state: {
    sendLeaseId?: string | null;
    sendLeaseExpiresAt?: number | null;
  },
  now: number,
) {
  return (
    state.sendLeaseId !== undefined &&
    state.sendLeaseId !== null &&
    state.sendLeaseExpiresAt !== undefined &&
    state.sendLeaseExpiresAt !== null &&
    state.sendLeaseExpiresAt > now
  );
}

function ownsSendLease(
  state: {
    sendLeaseId?: string | null;
    sendLeasePageHistoryId?: Id<"pageHistory"> | null;
    sendLeaseExpiresAt?: number | null;
  },
  args: {
    leaseId: string;
    now?: number;
    pageHistoryId: Id<"pageHistory">;
    requireActive?: boolean;
  },
) {
  if (state.sendLeaseId !== args.leaseId || state.sendLeasePageHistoryId !== args.pageHistoryId) {
    return false;
  }

  if (!args.requireActive) {
    return true;
  }

  return (
    state.sendLeaseExpiresAt !== undefined &&
    state.sendLeaseExpiresAt !== null &&
    args.now !== undefined &&
    state.sendLeaseExpiresAt > args.now
  );
}

function isTerminalPageAttemptStatus(status: unknown) {
  return status === "succeeded" || status === "failed";
}

async function loadOrCreatePagemState(ctx: MutationCtx) {
  let state = await ctx.db
    .query("pagemState")
    .withIndex("by_key", (q) => q.eq("key", DEFAULT_PAGEM_STATE_KEY))
    .unique();

  if (!state) {
    const stateId = await ctx.db.insert("pagemState", {
      key: DEFAULT_PAGEM_STATE_KEY,
      sessionCookie: null,
      csrfToken: null,
      status: "invalid",
      sessionVersion: 0,
      leaseId: null,
      leaseExpiresAt: null,
      lastBootstrappedAt: null,
      lastAuthenticatedAt: null,
      lastSendAt: null,
      lastErrorMessage: null,
      lastErrorAt: null,
      sendLeaseId: null,
      sendLeaseExpiresAt: null,
      sendLeasePageHistoryId: null,
    });
    state = await ctx.db.get(stateId);
  }

  if (!state) {
    throw new Error("Failed to initialize pagem state");
  }

  return state;
}

export const enqueuePageAttempt = internalMutation({
  args: {
    fromApiTokenName: v.optional(v.union(v.string(), v.null())),
    fromApiTokenId: v.optional(v.id("apiTokens")),
    fromUser: v.union(v.id("users"), v.null()),
    message: v.string(),
  },
  returns: v.object({
    leaseId: v.string(),
    pageHistoryId: v.id("pageHistory"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const state = await loadOrCreatePagemState(ctx);

    if (hasActiveSendLease(state, now)) {
      throw new ConvexError("There is already a page in progress!");
    }

    if (args.fromApiTokenId) {
      await ctx.db.patch(args.fromApiTokenId, {
        lastUsedAt: now,
      });
    }

    const pageHistoryId = await ctx.db.insert("pageHistory", {
      createdAt: now,
      errorMessage: null,
      finishedAt: null,
      fromApiTokenName: args.fromApiTokenName ?? null,
      fromUser: args.fromUser,
      leaseId: null,
      message: args.message,
      resultReauthenticated: null,
      resultRedirectedTo: null,
      resultStatus: null,
      startedAt: null,
      status: "pending",
    });
    const leaseId = pageHistoryId;

    await ctx.db.patch(pageHistoryId, {
      leaseId,
    });
    await ctx.db.patch(state._id, {
      sendLeaseExpiresAt: now + SEND_LEASE_DURATION_MS,
      sendLeaseId: leaseId,
      sendLeasePageHistoryId: pageHistoryId,
    });
    await ctx.scheduler.runAfter(0, internal.pager.processPageAttempt, {
      leaseId,
      pageHistoryId,
    });

    return {
      leaseId,
      pageHistoryId,
    };
  },
});

export const readPageAttempt = internalQuery({
  args: {
    pageHistoryId: v.id("pageHistory"),
  },
  returns: nullablePageAttemptDocValidator,
  handler: async (ctx, args) => ctx.db.get(args.pageHistoryId),
});

export const getMyPageAttempt = query({
  args: {
    pageHistoryId: v.id("pageHistory"),
  },
  returns: nullablePageAttemptDocValidator,
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const attempt = await ctx.db.get(args.pageHistoryId);
    if (!attempt || attempt.fromUser !== user._id) {
      return null;
    }
    return attempt;
  },
});

export const listMyPageAttempts = query({
  args: {
    limit: v.number(),
  },
  returns: v.array(pageAttemptDocValidator),
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    return ctx.db
      .query("pageHistory")
      .withIndex("by_fromUser", (q) => q.eq("fromUser", user._id))
      .order("desc")
      .take(args.limit);
  },
});

export const markPageAttemptRunning = internalMutation({
  args: {
    leaseId: v.string(),
    now: v.number(),
    pageHistoryId: v.id("pageHistory"),
  },
  returns: v.object({
    message: v.union(v.string(), v.null()),
    shouldProcess: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const state = await loadOrCreatePagemState(ctx);
    const attempt = await ctx.db.get(args.pageHistoryId);

    if (!attempt) {
      return { message: null, shouldProcess: false };
    }

    const ownsLease =
      ownsSendLease(state, {
        leaseId: args.leaseId,
        now: args.now,
        pageHistoryId: args.pageHistoryId,
        requireActive: true,
      }) && attempt.leaseId === args.leaseId;

    if (!ownsLease || isTerminalPageAttemptStatus(attempt.status)) {
      return { message: null, shouldProcess: false };
    }

    await ctx.db.patch(attempt._id, {
      startedAt: attempt.startedAt ?? args.now,
      status: "running",
    });

    return {
      message: attempt.message,
      shouldProcess: true,
    };
  },
});

export const markPageAttemptSucceeded = internalMutation({
  args: {
    leaseId: v.string(),
    now: v.number(),
    pageHistoryId: v.id("pageHistory"),
    result: sendPageResultValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await loadOrCreatePagemState(ctx);
    const attempt = await ctx.db.get(args.pageHistoryId);

    if (!attempt) {
      return null;
    }

    const ownsLease =
      ownsSendLease(state, {
        leaseId: args.leaseId,
        pageHistoryId: args.pageHistoryId,
      }) && attempt.leaseId === args.leaseId;

    if (!ownsLease) {
      return null;
    }

    await ctx.db.patch(attempt._id, {
      errorMessage: null,
      finishedAt: args.now,
      resultReauthenticated: args.result.reauthenticated,
      resultRedirectedTo: args.result.redirectedTo,
      resultStatus: args.result.status,
      startedAt: attempt.startedAt ?? args.now,
      status: "succeeded",
    });

    return null;
  },
});

export const markPageAttemptFailed = internalMutation({
  args: {
    errorMessage: v.string(),
    leaseId: v.string(),
    now: v.number(),
    pageHistoryId: v.id("pageHistory"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await loadOrCreatePagemState(ctx);
    const attempt = await ctx.db.get(args.pageHistoryId);

    if (!attempt) {
      return null;
    }

    const ownsLease =
      ownsSendLease(state, {
        leaseId: args.leaseId,
        pageHistoryId: args.pageHistoryId,
      }) && attempt.leaseId === args.leaseId;

    if (!ownsLease) {
      return null;
    }

    await ctx.db.patch(attempt._id, {
      errorMessage: args.errorMessage,
      finishedAt: args.now,
      startedAt: attempt.startedAt ?? args.now,
      status: "failed",
    });

    return null;
  },
});

export const releaseSendLease = internalMutation({
  args: {
    leaseId: v.string(),
    pageHistoryId: v.id("pageHistory"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await loadOrCreatePagemState(ctx);

    if (ownsSendLease(state, { leaseId: args.leaseId, pageHistoryId: args.pageHistoryId })) {
      await ctx.db.patch(state._id, {
        sendLeaseExpiresAt: null,
        sendLeaseId: null,
        sendLeasePageHistoryId: null,
      });
    }

    return null;
  },
});

export const processPageAttempt = internalAction({
  args: {
    leaseId: v.string(),
    pageHistoryId: v.id("pageHistory"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const running = await ctx.runMutation(internal.pager.markPageAttemptRunning, {
        leaseId: args.leaseId,
        now: Date.now(),
        pageHistoryId: args.pageHistoryId,
      });

      if (!running.shouldProcess || running.message === null) {
        return null;
      }

      const result = await ctx.runAction(internal.pagem.pager.sendPage, {
        body: running.message,
      });

      await ctx.runMutation(internal.pager.markPageAttemptSucceeded, {
        leaseId: args.leaseId,
        now: Date.now(),
        pageHistoryId: args.pageHistoryId,
        result,
      });
      return null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown pager send failure";

      try {
        await ctx.runMutation(internal.pager.markPageAttemptFailed, {
          errorMessage,
          leaseId: args.leaseId,
          now: Date.now(),
          pageHistoryId: args.pageHistoryId,
        });
      } catch (markError) {
        console.log("Failed to persist page attempt failure", {
          errorMessage:
            markError instanceof Error ? markError.message : "Unknown mark failure",
          pageHistoryId: args.pageHistoryId,
        });
      }

      throw error;
    } finally {
      await ctx.runMutation(internal.pager.releaseSendLease, {
        leaseId: args.leaseId,
        pageHistoryId: args.pageHistoryId,
      });
    }
  },
});

export const sendPage = action({
  args: {
    message: v.string(),
  },
  returns: v.object({
    pageHistoryId: v.id("pageHistory"),
    status: v.literal("pending"),
  }),
  handler: async (ctx, args): Promise<SendPageAccepted> => {
    const { user } = await requireUser(ctx);

    if (user.muted) {
      throw new ConvexError("You are muted! >:(");
    }

    const enqueueResult: { pageHistoryId: Id<"pageHistory">; leaseId: string } =
      await ctx.runMutation(internal.pager.enqueuePageAttempt, {
        fromApiTokenName: null,
        fromUser: user._id,
        message: `[${user.username}] ${args.message}`,
      });

    return {
      pageHistoryId: enqueueResult.pageHistoryId,
      status: "pending",
    };
  },
});

export const sendPageFromApiToken = internalAction({
  args: {
    apiTokenName: v.string(),
    tokenId: v.id("apiTokens"),
    message: v.string(),
  },
  returns: v.object({
    pageHistoryId: v.id("pageHistory"),
    status: v.literal("pending"),
  }),
  handler: async (ctx, args): Promise<SendPageAccepted> => {
    const enqueueResult: { pageHistoryId: Id<"pageHistory">; leaseId: string } =
      await ctx.runMutation(internal.pager.enqueuePageAttempt, {
        fromApiTokenName: args.apiTokenName,
        fromApiTokenId: args.tokenId,
        fromUser: null,
        message: `[${args.apiTokenName}] ${args.message}`,
      });

    return {
      pageHistoryId: enqueueResult.pageHistoryId,
      status: "pending",
    };
  },
});

export const listMyPageHistory = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    return ctx.db
      .query("pageHistory")
      .withIndex("by_fromUser", (q) => q.eq("fromUser", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

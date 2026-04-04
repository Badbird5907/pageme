import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { pagemStateFields } from "../schema";

const DEFAULT_KEY = "default";

const pagemStateDocValidator = v.object({
  _id: v.id("pagemState"),
  _creationTime: v.number(),
  ...pagemStateFields,
});

const nullablePagemStateDocValidator = v.union(pagemStateDocValidator, v.null());

function defaultState() {
  return {
    key: DEFAULT_KEY,
    sessionCookie: null,
    csrfToken: null,
    status: "invalid" as const,
    sessionVersion: 0,
    leaseId: null,
    leaseExpiresAt: null,
    lastBootstrappedAt: null,
    lastAuthenticatedAt: null,
    lastSendAt: null,
    lastErrorMessage: null,
    lastErrorAt: null,
  };
}

export const getOrCreateDefaultState = internalMutation({
  args: {},
  returns: pagemStateDocValidator,
  handler: async (ctx) => {
    let state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      const stateId = await ctx.db.insert("pagemState", defaultState());
      state = await ctx.db.get(stateId);
    }

    if (!state) {
      throw new Error("Failed to initialize pagem state");
    }

    return state;
  },
});

export const readDefaultState = internalQuery({
  args: {},
  returns: nullablePagemStateDocValidator,
  handler: async (ctx) => {
    return await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();
  },
});

export const tryAcquireRefreshLease = internalMutation({
  args: {
    leaseDurationMs: v.number(),
    leaseId: v.string(),
    now: v.number(),
  },
  returns: v.object({
    acquired: v.boolean(),
    state: pagemStateDocValidator,
  }),
  handler: async (ctx, args) => {
    let state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      const stateId = await ctx.db.insert("pagemState", defaultState());
      state = await ctx.db.get(stateId);
    }

    if (!state) {
      throw new Error("Failed to load pagem state");
    }

    const leaseActive =
      state.leaseId !== null &&
      state.leaseExpiresAt !== null &&
      state.leaseExpiresAt > args.now;

    if (!leaseActive) {
      await ctx.db.patch(state._id, {
        leaseExpiresAt: args.now + args.leaseDurationMs,
        leaseId: args.leaseId,
      });
      const updatedState = await ctx.db.get(state._id);
      if (!updatedState) {
        throw new Error("Failed to acquire refresh lease");
      }
      return { acquired: true, state: updatedState };
    }

    return { acquired: false, state };
  },
});

export const markAnonymousBootstrap = internalMutation({
  args: {
    csrfToken: v.string(),
    leaseId: v.string(),
    now: v.number(),
    sessionCookie: v.string(),
  },
  returns: pagemStateDocValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      throw new Error("Pagem state is not initialized");
    }

    if (state.leaseId !== args.leaseId) {
      throw new Error("Cannot bootstrap anonymous session without owning the lease");
    }

    await ctx.db.patch(state._id, {
      csrfToken: args.csrfToken,
      lastBootstrappedAt: args.now,
      lastErrorAt: null,
      lastErrorMessage: null,
      sessionCookie: args.sessionCookie,
      status: "anonymous",
    });

    const updatedState = await ctx.db.get(state._id);
    if (!updatedState) {
      throw new Error("Failed to persist anonymous bootstrap state");
    }

    return updatedState;
  },
});

export const commitAuthenticatedSession = internalMutation({
  args: {
    csrfToken: v.string(),
    leaseId: v.string(),
    now: v.number(),
    sessionCookie: v.string(),
  },
  returns: pagemStateDocValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      throw new Error("Pagem state is not initialized");
    }

    if (state.leaseId !== args.leaseId) {
      throw new Error("Cannot commit authenticated session without owning the lease");
    }

    await ctx.db.patch(state._id, {
      csrfToken: args.csrfToken,
      lastAuthenticatedAt: args.now,
      lastErrorAt: null,
      lastErrorMessage: null,
      leaseExpiresAt: null,
      leaseId: null,
      sessionCookie: args.sessionCookie,
      sessionVersion: state.sessionVersion + 1,
      status: "authenticated",
    });

    const updatedState = await ctx.db.get(state._id);
    if (!updatedState) {
      throw new Error("Failed to persist authenticated session");
    }

    return updatedState;
  },
});

export const refreshAuthenticatedCsrf = internalMutation({
  args: {
    csrfToken: v.string(),
    now: v.number(),
    sessionCookie: v.union(v.string(), v.null()),
  },
  returns: pagemStateDocValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      throw new Error("Pagem state is not initialized");
    }

    await ctx.db.patch(state._id, {
      csrfToken: args.csrfToken,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastBootstrappedAt: args.now,
      sessionCookie: args.sessionCookie ?? state.sessionCookie,
      status: "authenticated",
    });

    const updatedState = await ctx.db.get(state._id);
    if (!updatedState) {
      throw new Error("Failed to refresh authenticated pagem CSRF");
    }

    return updatedState;
  },
});

export const invalidateSession = internalMutation({
  args: {
    now: v.number(),
    reason: v.union(v.string(), v.null()),
  },
  returns: pagemStateDocValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      throw new Error("Pagem state is not initialized");
    }

    await ctx.db.patch(state._id, {
      csrfToken: null,
      lastErrorAt: args.reason === null ? null : args.now,
      lastErrorMessage: args.reason,
      leaseExpiresAt: null,
      leaseId: null,
      sessionCookie: null,
      status: "invalid",
    });

    const updatedState = await ctx.db.get(state._id);
    if (!updatedState) {
      throw new Error("Failed to invalidate pagem session");
    }

    return updatedState;
  },
});

export const recordSendSuccess = internalMutation({
  args: {
    now: v.number(),
  },
  returns: pagemStateDocValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      throw new Error("Pagem state is not initialized");
    }

    await ctx.db.patch(state._id, {
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSendAt: args.now,
    });

    const updatedState = await ctx.db.get(state._id);
    if (!updatedState) {
      throw new Error("Failed to record send success");
    }

    return updatedState;
  },
});

export const recordFailure = internalMutation({
  args: {
    message: v.string(),
    now: v.number(),
  },
  returns: pagemStateDocValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      throw new Error("Pagem state is not initialized");
    }

    await ctx.db.patch(state._id, {
      lastErrorAt: args.now,
      lastErrorMessage: args.message,
    });

    const updatedState = await ctx.db.get(state._id);
    if (!updatedState) {
      throw new Error("Failed to record pagem failure");
    }

    return updatedState;
  },
});

export const releaseLease = internalMutation({
  args: {
    leaseId: v.string(),
  },
  returns: pagemStateDocValidator,
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("pagemState")
      .withIndex("by_key", (q) => q.eq("key", DEFAULT_KEY))
      .unique();

    if (!state) {
      throw new Error("Pagem state is not initialized");
    }

    if (state.leaseId === args.leaseId) {
      await ctx.db.patch(state._id, {
        leaseExpiresAt: null,
        leaseId: null,
      });
    }

    const updatedState = await ctx.db.get(state._id);
    if (!updatedState) {
      throw new Error("Failed to release pagem lease");
    }

    return updatedState;
  },
});

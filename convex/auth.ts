import { customAction, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  ActionCtx,
  QueryCtx,
  MutationCtx,
  action as rawAction,
  internalQuery,
  mutation as rawMutation,
  query as rawQuery,
} from "./_generated/server";
import { env } from "./env";
import { mintJwt, verifyJwt as verifyJwtToken, type JwtClaims } from "../src/lib/jwt";

const loginArgs = {
  username: v.string(),
  pin: v.string(),
};

const authArgs = {
  token: v.string(),
};

type LoginArgs = {
  username: string;
  pin: string;
};

async function verifyJwt(token: string): Promise<JwtClaims> {
  try {
    return await verifyJwtToken(token, env.AUTH_JWT_SECRET);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid auth token";
    throw new ConvexError(message);
  }
}

function assertValidLogin(user: Doc<"users"> | null, pin: string) {
  if (!user) {
    throw new ConvexError("User not found");
  }
  if (user.pin !== pin) {
    throw new ConvexError("Invalid pin");
  }
  if (user.activeUntil && user.activeUntil < Date.now()) {
    throw new ConvexError("User is inactive");
  }
  return user;
}

async function validateLogin(ctx: QueryCtx | MutationCtx, args: LoginArgs) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", args.username))
    .first();
  return assertValidLogin(user, args.pin);
}

function validateUserState(user: Doc<"users"> | null) {
  if (!user) {
    throw new ConvexError("User not found");
  }
  if (user.activeUntil && user.activeUntil < Date.now()) {
    throw new ConvexError("User is inactive");
  }
  return user;
}

export const getLoginToken = internalQuery({
  args: loginArgs,
  returns: v.object({
    expiresAt: v.number(),
    token: v.string(),
    isAdmin: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await validateLogin(ctx, args);
    return {
      ...(await mintJwt(
        { sub: user._id, username: user.username, admin: user.isAdmin },
        env.AUTH_JWT_SECRET,
      )),
      isAdmin: user.isAdmin,
    };
  },
});

export const getUserById = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

export const authedQuery = customQuery(rawQuery, {
  args: authArgs,
  input: async (ctx, args) => {
    const claims = await verifyJwt(args.token);
    const user = validateUserState(await ctx.db.get(claims.sub as Id<"users">));
    if (user.username !== claims.username) {
      throw new ConvexError("Invalid auth token");
    }
    return {
      ctx: { ...ctx, user, claims },
      args: {},
    };
  },
});

export const authedMutation = customMutation(rawMutation, {
  args: authArgs,
  input: async (ctx, args) => {
    const claims = await verifyJwt(args.token);
    const user = validateUserState(await ctx.db.get(claims.sub as Id<"users">));
    if (user.username !== claims.username) {
      throw new ConvexError("Invalid auth token");
    }
    return {
      ctx: { ...ctx, user, claims },
      args: {},
    };
  },
});

export const authedAction = customAction(rawAction, {
  args: authArgs,
  input: async (ctx, args) => {
    const claims = await verifyJwt(args.token);
    const rawUser: Doc<"users"> | null = await ctx.runQuery(internal.auth.getUserById, {
      userId: claims.sub as Id<"users">,
    });
    const user = validateUserState(rawUser);
    if (user.username !== claims.username) {
      throw new ConvexError("Invalid auth token");
    }
    return {
      ctx: { ...ctx, user, claims },
      args: {},
    };
  },
});

export const adminQuery = customQuery(rawQuery, {
  args: authArgs,
  input: async (ctx, args) => {
    const claims = await verifyJwt(args.token);
    const user = validateUserState(await ctx.db.get(claims.sub as Id<"users">));
    if (user.username !== claims.username) {
      throw new ConvexError("Invalid auth token");
    }
    if (!claims.admin) {
      throw new ConvexError("Unauthorized");
    }
    return {
      ctx: { ...ctx, user, claims },
      args: {},
    };
  },
});

export const adminMutation = customMutation(rawMutation, {
  args: authArgs,
  input: async (ctx, args) => {
    const claims = await verifyJwt(args.token);
    const user = validateUserState(await ctx.db.get(claims.sub as Id<"users">));
    if (user.username !== claims.username) {
      throw new ConvexError("Invalid auth token");
    }
    if (!claims.admin) {
      throw new ConvexError("Unauthorized");
    }
    return {
      ctx: { ...ctx, user, claims },
      args: {},
    };
  },
});

export const adminAction = customAction(rawAction, {
  args: authArgs,
  input: async (ctx, args) => {
    const claims = await verifyJwt(args.token);
    const rawUser: Doc<"users"> | null = await ctx.runQuery(internal.auth.getUserById, {
      userId: claims.sub as Id<"users">,
    });
    const user = validateUserState(rawUser);
    if (user.username !== claims.username) {
      throw new ConvexError("Invalid auth token");
    }
    if (!claims.admin) {
      throw new ConvexError("Unauthorized");
    }
    return {
      ctx: { ...ctx, user, claims },
      args: {},
    };
  },
});

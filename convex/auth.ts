import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { type Doc, type Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
  internalQuery,
} from "./_generated/server";
import { env } from "./env";
import { mintJwt, type JwtConfig } from "../src/lib/jwt";

const loginArgs = {
  username: v.string(),
  pin: v.string(),
};

type LoginArgs = {
  pin: string;
  username: string;
};

type Identity = NonNullable<Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>>;
type AuthenticatedCtx = ActionCtx | MutationCtx | QueryCtx;
type AuthenticatedUser = {
  identity: Identity;
  user: Doc<"users">;
};

function getJwtConfig(): JwtConfig {
  return {
    audience: env.AUTH_JWT_AUDIENCE,
    issuer: env.AUTH_JWT_ISSUER,
    kid: env.AUTH_JWT_KID,
    privateKeyPem: env.AUTH_JWT_PRIVATE_KEY_PEM,
    publicJwkJson: env.AUTH_JWT_PUBLIC_JWK_JSON,
  };
}

function hasDb(ctx: AuthenticatedCtx): ctx is MutationCtx | QueryCtx {
  return "db" in ctx;
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

export async function requireIdentity(
  ctx: Pick<AuthenticatedCtx, "auth">,
): Promise<Identity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Not authenticated");
  }
  return identity;
}

export async function requireUser(
  ctx: AuthenticatedCtx,
): Promise<AuthenticatedUser> {
  const identity = await requireIdentity(ctx);
  const user = hasDb(ctx)
    ? await ctx.db.get(identity.subject as Id<"users">)
    : await ctx.runQuery(internal.auth.getUserById, {
        userId: identity.subject as Id<"users">,
      });

  return {
    identity,
    user: validateUserState(user),
  };
}

export async function requireAdmin(
  ctx: AuthenticatedCtx,
): Promise<AuthenticatedUser> {
  const { identity, user } = await requireUser(ctx);
  if (identity.admin !== true) {
    throw new ConvexError("Unauthorized");
  }
  return { identity, user };
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
        getJwtConfig(),
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

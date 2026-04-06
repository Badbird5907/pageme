import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";
import { ConvexError, v } from "convex/values";

export const listAPITokens = query({
  args: {},
  returns: v.array(
    v.object({
      token: v.string(),
      name: v.string(),
      createdAt: v.number(),
      expiresAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    const tokens = await ctx.db.query("apiTokens").collect();
    return tokens.map(({ token, name, createdAt, expiresAt }) => ({
      token,
      name,
      createdAt,
      ...(expiresAt === undefined ? {} : { expiresAt }),
    }));
  },
})


export const createAPIToken = mutation({
  args: {
    name: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    const token = crypto.randomUUID();
    await ctx.db.insert("apiTokens", {
      token,
      name: args.name,
      createdAt: Date.now(),
      ...(args.expiresAt === null ? {} : { expiresAt: args.expiresAt }),
    });
    return { token };
  },
})

export const deleteAPIToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    const existing = await ctx.db.query("apiTokens").withIndex("by_token", q => q.eq("token", args.token)).first();
    if (!existing) {
      throw new ConvexError("Token not found");
    }
    await ctx.db.delete(existing._id);
    return { success: true };
  },
})

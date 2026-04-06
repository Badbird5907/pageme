import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    return await ctx.db.query("users").collect();
  },
})

export const toggleMute = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("User not found");
    }
    await ctx.db.patch(args.userId, {
      muted: !target.muted,
    });
    return { muted: !target.muted };
  },
})

export const createUser = mutation({
  args: {
    username: v.string(),
    pin: v.string(),
    activeUntil: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    const existing = await ctx.db.query("users").withIndex("by_username", q => q.eq("username", args.username)).first();
    if (existing) {
      throw new ConvexError("User already exists");
    }
    await ctx.db.insert("users", {
      username: args.username,
      pin: args.pin,
      muted: false,
      isAdmin: false,
      createdAt: Date.now(),
      ...(args.activeUntil === null ? {} : { activeUntil: args.activeUntil }),
    });
    return { success: true };
  },
})

export const updateUserActiveUntil = mutation({
  args: {
    userId: v.id("users"),
    activeUntil: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }

    const target = await ctx.db.get(args.userId);
    if (!target) {
      throw new ConvexError("User not found");
    }

    await ctx.db.replace(args.userId, {
      username: target.username,
      pin: target.pin,
      muted: target.muted,
      isAdmin: target.isAdmin,
      createdAt: target.createdAt,
      ...(args.activeUntil === null ? {} : { activeUntil: args.activeUntil }),
    });

    return { success: true };
  },
})

export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    if (user._id === args.userId) {
      throw new ConvexError("Cannot delete yourself");
    }
    await ctx.db.delete(args.userId);
    return { success: true };
  },
})

import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";

export const getMCPEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    const setting = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "mcp_enabled")).first();
    return setting?.value ?? false;
  },
})

export const setMCPEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAdmin(ctx);
    if (!user.isAdmin) {
      throw new ConvexError("Unauthorized");
    }
    const existing = await ctx.db.query("settings").withIndex("by_key", q => q.eq("key", "mcp_enabled")).first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.enabled,
      });
    } else {
      await ctx.db.insert("settings", {
        key: "mcp_enabled",
        value: args.enabled,
      });
    }
    return { enabled: args.enabled };
  },
})

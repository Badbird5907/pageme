import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const pagemStateFields = {
  key: v.string(),
  sessionCookie: v.union(v.string(), v.null()),
  csrfToken: v.union(v.string(), v.null()),
  status: v.union(
    v.literal("anonymous"),
    v.literal("authenticated"),
    v.literal("invalid"),
  ),
  sessionVersion: v.number(),
  leaseId: v.union(v.string(), v.null()),
  leaseExpiresAt: v.union(v.number(), v.null()),
  lastBootstrappedAt: v.union(v.number(), v.null()),
  lastAuthenticatedAt: v.union(v.number(), v.null()),
  lastSendAt: v.union(v.number(), v.null()),
  lastErrorMessage: v.union(v.string(), v.null()),
  lastErrorAt: v.union(v.number(), v.null()),
};

export default defineSchema({
  pagemState: defineTable(pagemStateFields).index("by_key", ["key"]),
  users: defineTable({
    username: v.string(),
    pin: v.string(),
    muted: v.boolean(), // ban them?
    isAdmin: v.boolean(),
    createdAt: v.number(),
    activeUntil: v.optional(v.number()),
  }).index("by_username", ["username"]),
  mcpTokens: defineTable({
    token: v.string(),
    name: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  }),
  pageHistory: defineTable({
    fromUser: v.id("users"),
    message: v.string(),
    createdAt: v.number(),
  }).index("by_fromUser", ["fromUser"]).index("by_createdAt", ["createdAt"]),
});

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
  // Optional for compatibility with existing pagemState documents.
  sendLeaseId: v.optional(v.union(v.string(), v.null())),
  // Optional for compatibility with existing pagemState documents.
  sendLeaseExpiresAt: v.optional(v.union(v.number(), v.null())),
  // Optional for compatibility with existing pagemState documents.
  sendLeasePageHistoryId: v.optional(v.union(v.id("pageHistory"), v.null())),
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
  settings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
  apiTokens: defineTable({
    token: v.string(),
    name: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  }).index("by_token", ["token"]),
  pageHistory: defineTable({
    fromUser: v.id("users"),
    message: v.string(),
    createdAt: v.number(),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
    )),
    startedAt: v.optional(v.union(v.number(), v.null())),
    finishedAt: v.optional(v.union(v.number(), v.null())),
    errorMessage: v.optional(v.union(v.string(), v.null())),
    resultStatus: v.optional(v.union(v.number(), v.null())),
    resultRedirectedTo: v.optional(v.union(v.string(), v.null())),
    resultReauthenticated: v.optional(v.union(v.boolean(), v.null())),
    leaseId: v.optional(v.union(v.string(), v.null())),
  }).index("by_fromUser", ["fromUser"])
  .index("by_createdAt", ["createdAt"])
  .index("by_createdAt_fromUser", ["createdAt", "fromUser"])
});

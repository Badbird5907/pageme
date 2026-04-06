import { ConvexError, v } from "convex/values";
import { authedAction } from "./auth";


export const sendPage = authedAction({
  args: {
    message: v.string(),
  },
  handler: async (ctx) => {
    if (ctx.user.muted) {
      throw new ConvexError("You are muted!");
    }
  },
})

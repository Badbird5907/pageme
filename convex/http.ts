import { Hono } from "hono";
import { cors } from "hono/cors";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { ActionCtx } from "./_generated/server";

const app: HonoWithConvex<ActionCtx> = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type"],
  }),
);

const loginBodySchema = z.object({
  pin: z.string(),
  username: z.string(),
});

app.post("/auth/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid login body" }, 400);
  }

  try {
    const token = await c.env.runQuery(internal.auth.getLoginToken, parsed.data);
    return c.json({ token: token.token, isAdmin: token.isAdmin }, 200);
  } catch (error) {
    if (error instanceof ConvexError) {
      return c.json({ error: error.message }, 401);
    }
    throw error;
  }
});


const router = new HttpRouterWithHono(app);

export default router;
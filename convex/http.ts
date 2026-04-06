import { Hono } from "hono";
import { cors } from "hono/cors";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { ActionCtx } from "./_generated/server";
import { env } from "./env";
import { getJwtJwks } from "../src/lib/jwt";
import { Muppet } from "muppet";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Id } from "./_generated/dataModel";

const app: HonoWithConvex<ActionCtx> = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type", "Mcp-Session-Id"],
  }),
);

const loginBodySchema = z.object({
  pin: z.string(),
  username: z.string(),
});

type AuthenticatedApiToken = {
  tokenName: string;
  tokenId: string;
};

app.get("/.well-known/jwks.json", async (c) => {
  return c.json(
    getJwtJwks({
      kid: env.AUTH_JWT_KID,
      publicJwkJson: env.AUTH_JWT_PUBLIC_JWK_JSON,
    }),
    200,
  );
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
    const token = await c.env.runMutation(internal.auth.getLoginToken, parsed.data);
    return c.json({ token: token.token, isAdmin: token.isAdmin }, 200);
  } catch (error) {
    if (error instanceof ConvexError) {
      return c.json({ error: error.message }, 401);
    }
    throw error;
  }
});

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || rest.length > 0) {
    return null;
  }

  return token;
}

async function authenticateMcpRequest(
  convex: ActionCtx,
  authorizationHeader: string | undefined,
): Promise<
  | { ok: true; token: AuthenticatedApiToken }
  | { error: string; ok: false; status: 401 | 403 }
> {
  const token = getBearerToken(authorizationHeader);
  if (!token) {
    return { error: "Missing or invalid Authorization header", ok: false, status: 401 };
  }

  const mcpEnabled = await convex.runQuery(internal.mcp.isMcpEnabledInternal, {});
  if (!mcpEnabled) {
    return { error: "MCP is disabled", ok: false, status: 403 };
  }

  const authenticatedToken = await convex.runQuery(
    internal.apitokens.authenticateApiToken,
    { token },
  );

  if (!authenticatedToken) {
    return { error: "Invalid or expired API token", ok: false, status: 401 };
  }

  return {
    ok: true,
    token: {
      tokenName: authenticatedToken.name,
      tokenId: authenticatedToken.id,
    },
  };
}

function createMcp(convex: ActionCtx, auth: AuthenticatedApiToken) {
  const mcp = new Muppet({
    name: "convex-mcp",
    version: "0.0.1",
  });

  mcp.tool({
    name: "send-page",
    description: "Send a page. This is a real pager, and it is extremely loud and disruptive. Only use this if you are absolutely sure you need to.",
    inputSchema: z.object({
      message: z.string().min(1),
    }),
  }, async (c) => {
    const message = c.message.params.arguments.message;
    const result = await convex.runAction(internal.pager.sendPageFromApiToken, {
      apiTokenName: auth.tokenName,
      tokenId: auth.tokenId as Id<"apiTokens">,
      message,
    });

    return {
      content: [
        {
          type: "text",
          text:
            `Queued page from API token "${auth.tokenName}". ` +
            `Status: ${result.status}. Page history id: ${result.pageHistoryId}.`,
        },
      ],
      structuredContent: {
        pageHistoryId: result.pageHistoryId,
        status: result.status,
        tokenName: auth.tokenName,
      },
    };
  });

  return mcp;
}

app.all("/mcp", async (c) => {
  const auth = await authenticateMcpRequest(
    c.env,
    c.req.header("Authorization"),
  );
  if (!auth.ok) {
    return c.json({ error: auth.error }, auth.status);
  }

  const mcp = createMcp(c.env, auth.token);
  const transport = new StreamableHTTPTransport();
  await mcp.connect(transport);
  return transport.handleRequest(c);
});


const router = new HttpRouterWithHono(app);

export default router;

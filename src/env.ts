import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AUTH_JWT_AUDIENCE: z.string().min(1),
    AUTH_JWT_ISSUER: z.url().optional(),
    AUTH_JWT_KID: z.string().min(1),
    AUTH_JWT_PUBLIC_JWK_JSON: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_CONVEX_SITE_URL: z.string().url(),
    NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
});

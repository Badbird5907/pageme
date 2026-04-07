import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    AUTH_JWT_AUDIENCE: z.string().min(1),
    AUTH_JWT_ISSUER: z.url().optional(),
    CONVEX_SITE_URL: z.url(),
    AUTH_JWT_KID: z.string().min(1),
    AUTH_JWT_PRIVATE_KEY_PEM: z.string().min(1),
    AUTH_JWT_PUBLIC_JWK_JSON: z.string().min(1),
    PAGEM_GROUP_PAGE_TYPE: z.string().min(1).optional(),
    PAGEM_PAGE_DIRECTORY_ENTRY_ID: z
      .string()
      .regex(/^\d+$/)
      .optional(),
    PAGEM_PASSWORD: z.string().min(1).optional(),
    PAGEM_USERNAME: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
});

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    AUTH_JWT_SECRET: z.string().min(1),
    PAGEM_BASE_URL: z.string().url().optional(),
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

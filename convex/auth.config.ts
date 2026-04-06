import { type AuthConfig } from "convex/server";
import { env } from "./env";

export default {
  providers: [
    {
      type: "customJwt",
      applicationID: env.AUTH_JWT_AUDIENCE,
      issuer: env.AUTH_JWT_ISSUER,
      jwks: `${env.AUTH_JWT_ISSUER}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
} satisfies AuthConfig;

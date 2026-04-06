import { ms } from "ms";
import {
  errors,
  importJWK,
  importPKCS8,
  jwtVerify,
  SignJWT,
  type JWK,
} from "jose";
import { z } from "zod";

export const JWT_TTL_MS = ms("1d");
export const JWT_ALG = "RS256" as const;

export type JwtClaims = {
  admin: boolean;
  aud: string | string[];
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  username: string;
};

export type JwtMintUser = {
  admin: boolean;
  sub: string;
  username: string;
};

export type JwtConfig = {
  audience: string;
  issuer: string;
  kid: string;
  privateKeyPem?: string;
  publicJwkJson: string;
};

const jwtHeaderSchema = z
  .object({
    alg: z.literal(JWT_ALG),
    kid: z.string().min(1),
    typ: z.literal("JWT"),
  })
  .strict();

const jwtClaimsSchema = z
  .object({
    admin: z.boolean(),
    aud: z.union([z.string(), z.array(z.string())]),
    exp: z.number().int(),
    iat: z.number().int(),
    iss: z.string().min(1),
    sub: z.string().min(1),
    username: z.string().min(1),
  })
  .strict();

const publicJwkSchema = z
  .object({
    kty: z.string().min(1),
  })
  .passthrough();

function getPublicJwk(config: Pick<JwtConfig, "kid" | "publicJwkJson">): JWK {
  let parsed: unknown;
  try {
    parsed = JSON.parse(config.publicJwkJson);
  } catch {
    throw new Error("Invalid AUTH_JWT_PUBLIC_JWK_JSON");
  }

  const jwk = publicJwkSchema.parse(parsed) as JWK;
  return {
    ...jwk,
    alg: JWT_ALG,
    kid: config.kid,
    use: "sig",
  };
}

export function getJwtJwks(config: Pick<JwtConfig, "kid" | "publicJwkJson">) {
  return {
    keys: [getPublicJwk(config)],
  };
}

export async function mintJwt(user: JwtMintUser, config: JwtConfig) {
  if (!config.privateKeyPem) {
    throw new Error("Missing AUTH_JWT_PRIVATE_KEY_PEM");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = Math.floor((Date.now() + JWT_TTL_MS) / 1000);
  const privateKey = await importPKCS8(config.privateKeyPem, JWT_ALG);

  const token = await new SignJWT({
    admin: user.admin,
    username: user.username,
  })
    .setProtectedHeader({ alg: JWT_ALG, kid: config.kid, typ: "JWT" })
    .setAudience(config.audience)
    .setExpirationTime(expiresAt)
    .setIssuedAt(issuedAt)
    .setIssuer(config.issuer)
    .setSubject(user.sub)
    .sign(privateKey);

  return {
    expiresAt: expiresAt * 1000,
    token,
  };
}

export async function verifyJwt(token: string, config: JwtConfig): Promise<JwtClaims> {
  try {
    const publicKey = await importJWK(getPublicJwk(config), JWT_ALG);
    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      algorithms: [JWT_ALG],
      audience: config.audience,
      issuer: config.issuer,
    });

    const header = jwtHeaderSchema.parse(protectedHeader);
    if (header.kid !== config.kid) {
      throw new Error("Invalid auth token");
    }

    return jwtClaimsSchema.parse(payload);
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new Error("Auth token expired");
    }
    if (error instanceof z.ZodError) {
      throw new Error("Invalid auth token");
    }
    if (error instanceof Error && error.message === "Invalid AUTH_JWT_PUBLIC_JWK_JSON") {
      throw error;
    }
    throw new Error("Invalid auth token");
  }
}

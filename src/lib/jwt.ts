import { ms } from "ms";
import { z } from "zod";

export const JWT_TTL_MS = ms("1d");
export const JWT_ALG = "HS256";

export type JwtClaims = {
  sub: string;
  username: string;
  admin: boolean;
  iat: number;
  exp: number;
};

export type JwtMintUser = {
  sub: string;
  username: string;
  admin: boolean;
};

const jwtHeaderSchema = z
  .object({
    alg: z.string(),
    typ: z.string().optional(),
  })
  .strict();

const jwtClaimsSchema = z
  .object({
    sub: z.string(),
    username: z.string(),
    admin: z.boolean(),
    iat: z.number(),
    exp: z.number(),
  })
  .strict();

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeString(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlDecodeBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeString(value: string) {
  return new TextDecoder().decode(base64UrlDecodeBytes(value));
}

async function hmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return new Uint8Array(signature);
}

function constantTimeEquals(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

export async function mintJwt(user: JwtMintUser, secret: string) {
  const now = Date.now();
  const claims: JwtClaims = {
    sub: user.sub,
    username: user.username,
    admin: user.admin,
    iat: now,
    exp: now + JWT_TTL_MS,
  };

  const header = base64UrlEncodeString(JSON.stringify({ alg: JWT_ALG, typ: "JWT" }));
  const payload = base64UrlEncodeString(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const signature = await hmacSha256(secret, signingInput);

  return {
    expiresAt: claims.exp,
    token: `${signingInput}.${base64UrlEncodeBytes(signature)}`,
  };
}

export async function verifyJwt(token: string, secret: string): Promise<JwtClaims> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid auth token");
  }

  let header: { alg: string };
  let claims: JwtClaims;
  try {
    const decodedHeader = JSON.parse(base64UrlDecodeString(encodedHeader)) as unknown;
    const decodedPayload = JSON.parse(base64UrlDecodeString(encodedPayload)) as unknown;
    header = jwtHeaderSchema.parse(decodedHeader);
    claims = jwtClaimsSchema.parse(decodedPayload);
  } catch {
    throw new Error("Invalid auth token");
  }

  if (header.alg !== JWT_ALG) {
    throw new Error("Invalid auth token");
  }

  if (claims.exp <= Date.now()) {
    throw new Error("Auth token expired");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = await hmacSha256(secret, signingInput);
  const actualSignature = base64UrlDecodeBytes(encodedSignature);
  if (!constantTimeEquals(actualSignature, expectedSignature)) {
    throw new Error("Invalid auth token");
  }

  return claims;
}

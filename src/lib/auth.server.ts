import { env } from "@/env";
import type { JwtClaims } from "@/lib/jwt";
import { verifyJwt } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function getAuthClaims(): Promise<JwtClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    return await verifyJwt(token, {
      audience: env.AUTH_JWT_AUDIENCE,
      issuer: env.AUTH_JWT_ISSUER ?? env.NEXT_PUBLIC_CONVEX_SITE_URL,
      kid: env.AUTH_JWT_KID,
      publicJwkJson: env.AUTH_JWT_PUBLIC_JWK_JSON,
    });
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const claims = await getAuthClaims();
  return claims !== null;
}

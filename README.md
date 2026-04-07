# Pager

Pager is a web app that wraps [Pagem](https://www.pagem.com). It lets you give out pager access without paying for additional Pagem seats.

It also exposes an MCP server for AI assistants.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the required environment variables.
3. Install dependencies with `pnpm install`.
4. Start the app with `pnpm dev`.

The app runs Next.js locally and connects to Convex for backend functions.

## Environment Variables

### Local `.env.local`

For local development, the root `.env.local` should contain:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-project.convex.site

AUTH_JWT_ISSUER=https://your-project.convex.site
AUTH_JWT_AUDIENCE=pageme-web
AUTH_JWT_KID=pageme-rs256-1
AUTH_JWT_PUBLIC_JWK_JSON={"kty":"RSA","n":"...","e":"AQAB","alg":"RS256","kid":"pageme-rs256-1","use":"sig"}
AUTH_JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"

PAGEM_USERNAME=
PAGEM_PASSWORD=
PAGEM_BASE_URL=
PAGEM_GROUP_PAGE_TYPE=
PAGEM_PAGE_DIRECTORY_ENTRY_ID=
```

Notes:

- `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` are the Convex URLs given to you by Convex
- `AUTH_JWT_ISSUER` should be the same as  `NEXT_PUBLIC_CONVEX_SITE_URL`.
- `AUTH_JWT_AUDIENCE` must match `convex/auth.config.ts`. The app currently expects `pageme-web`.
- `AUTH_JWT_PUBLIC_JWK_JSON` must be the public JWK matching the private key used by Convex to sign JWTs.
- For local development, keep `AUTH_JWT_PRIVATE_KEY_PEM` in `.env.local` too

### Vercel

Set these values in the Vercel project:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-project.convex.site
AUTH_JWT_ISSUER=https://your-project.convex.site
AUTH_JWT_AUDIENCE=pageme-web
AUTH_JWT_KID=pageme-rs256-1
AUTH_JWT_PUBLIC_JWK_JSON={"kty":"RSA","n":"...","e":"AQAB","alg":"RS256","kid":"pageme-rs256-1","use":"sig"}

PAGEM_USERNAME=
PAGEM_PASSWORD=
PAGEM_BASE_URL=
PAGEM_GROUP_PAGE_TYPE=
PAGEM_PAGE_DIRECTORY_ENTRY_ID=
```

### Convex

These variables must be configured on the Convex deployment:

```env
AUTH_JWT_ISSUER=https://your-project.convex.site
AUTH_JWT_AUDIENCE=pageme-web
AUTH_JWT_KID=pageme-rs256-1
AUTH_JWT_PUBLIC_JWK_JSON={"kty":"RSA","n":"...","e":"AQAB","alg":"RS256","kid":"pageme-rs256-1","use":"sig"}
AUTH_JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"

PAGEM_USERNAME=
PAGEM_PASSWORD=
PAGEM_BASE_URL=
PAGEM_GROUP_PAGE_TYPE=
PAGEM_PAGE_DIRECTORY_ENTRY_ID=
```

Notes:

- `AUTH_JWT_PUBLIC_JWK_JSON` must match that private key exactly.
- `AUTH_JWT_KID` should be a stable identifier for the active signing key (don't change it)

## JWT Setup

This app uses Convex custom JWT auth with `RS256`.

- `iss` must equal `AUTH_JWT_ISSUER`.
- `aud` must equal `AUTH_JWT_AUDIENCE`.
- The JWT header must include `alg`, `kid`, and `typ`.
- The JWT payload must include `sub`, `iss`, `iat`, and `exp`.
- Convex verifies the JWT against `https://your-project.convex.site/.well-known/jwks.json`.

### Generate `AUTH_JWT_PRIVATE_KEY_PEM` and `AUTH_JWT_PUBLIC_JWK_JSON`

Generate a RSA private key and public JWK with:

```bash
pnpm auth:generate-jwt-keys
```

## Deploy

### 1. Configure Env Vars

Set the Next.js variables in Vercel project settings.

Set the Convex variables either in the Convex dashboard or with the CLI:

```bash
npx convex env set AUTH_JWT_ISSUER https://your-project.convex.site
npx convex env set AUTH_JWT_AUDIENCE pageme-web
npx convex env set AUTH_JWT_KID pageme-rs256-1
npx convex env set AUTH_JWT_PUBLIC_JWK_JSON '{"kty":"RSA","n":"...","e":"AQAB","alg":"RS256","kid":"pageme-rs256-1","use":"sig"}'
npx convex env set AUTH_JWT_PRIVATE_KEY_PEM '-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----'
```

### 2. Deploy Convex

Deploy backend functions first:

```bash
npx convex deploy
```

### 3. Deploy Next.js

After Convex is deployed and its env vars are set, deploy the frontend on Vercel.

Make sure to the Vercel project has the required environment variables.

## Useful Commands

```bash
pnpm install
pnpm auth:generate-jwt-keys
pnpm dev
pnpm lint
pnpm exec tsc --noEmit
npx convex env list
npx convex deploy
```

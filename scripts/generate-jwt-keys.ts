import { generateKeyPairSync } from "node:crypto";
import { exportJWK } from "jose";

function formatDateForKid(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseKidArg() {
  const kidArg = process.argv.find((arg) => arg.startsWith("--kid="));
  if (kidArg) {
    return kidArg.slice("--kid=".length);
  }

  const positionalKid = process.argv[2];
  if (positionalKid && !positionalKid.startsWith("--")) {
    return positionalKid;
  }

  return `pageme-rs256-${formatDateForKid(new Date())}`;
}

async function main() {
  const kid = parseKidArg();
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const publicJwk = await exportJWK(publicKey);
  publicJwk.alg = "RS256";
  publicJwk.kid = kid;
  publicJwk.use = "sig";

  const privateKeyPem = privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  console.log(`AUTH_JWT_KID=${kid}`);
  console.log("");
  console.log("AUTH_JWT_PRIVATE_KEY_PEM=");
  console.log(privateKeyPem);
  console.log("");
  console.log(`AUTH_JWT_PUBLIC_JWK_JSON="${JSON.stringify(publicJwk)}"`);
  console.log("");
  console.log("AUTH_JWT_AUDIENCE=pageme-web");
}

void main();

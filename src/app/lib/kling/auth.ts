import * as jwt from "jsonwebtoken";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createKlingJwt(): string {
  const accessKey = getRequiredEnv("KLING_ACCESS_KEY");
  const secretKey = getRequiredEnv("KLING_SECRET_KEY");

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: accessKey,
    exp: now + 1800,
    nbf: now - 5,
  };

  return jwt.sign(payload, secretKey, {
    algorithm: "HS256",
    header: {
      alg: "HS256",
      typ: "JWT",
    },
  }) as string;
}

export function getKlingAuthorizationHeader(): string {
  return `Bearer ${createKlingJwt()}`;
}
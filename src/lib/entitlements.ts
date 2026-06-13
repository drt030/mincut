import { SignJWT, jwtVerify } from "jose";

export const ENTITLEMENT_COOKIE = "cge_ent";

function secret(): Uint8Array | null {
  const value = process.env.ENTITLEMENT_SECRET;
  if (!value) return null;
  return new TextEncoder().encode(value);
}

export async function grantCookieValue(entitlement: string, existing: string[]): Promise<string> {
  const signingSecret = secret();
  if (!signingSecret) {
    throw new Error("ENTITLEMENT_SECRET is required to grant entitlements");
  }

  const list = [...new Set([...existing, entitlement])];
  return new SignJWT({ e: list })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("400d")
    .sign(signingSecret);
}

export async function readEntitlements(cookieValue: string | undefined): Promise<string[]> {
  if (!cookieValue) return [];
  const verificationSecret = secret();
  if (!verificationSecret) return [];

  try {
    const { payload } = await jwtVerify(cookieValue, verificationSecret);
    return Array.isArray(payload.e) ? (payload.e as string[]) : [];
  } catch {
    return [];
  }
}

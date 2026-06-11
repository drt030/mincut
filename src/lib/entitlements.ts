import { SignJWT, jwtVerify } from "jose";

export const ENTITLEMENT_COOKIE = "cge_ent";
const secret = () => new TextEncoder().encode(process.env.ENTITLEMENT_SECRET ?? "");

export async function grantCookieValue(entitlement: string, existing: string[]): Promise<string> {
  const list = [...new Set([...existing, entitlement])];
  return new SignJWT({ e: list })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("400d")
    .sign(secret());
}

export async function readEntitlements(cookieValue: string | undefined): Promise<string[]> {
  if (!cookieValue) return [];
  try {
    const { payload } = await jwtVerify(cookieValue, secret());
    return Array.isArray(payload.e) ? (payload.e as string[]) : [];
  } catch {
    return [];
  }
}

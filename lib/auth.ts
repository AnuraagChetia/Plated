import { SignJWT, jwtVerify } from "jose";
export const SESSION_COOKIE = "plated_session";
const key = new TextEncoder().encode(process.env.AUTH_SECRET || "local-development-secret-change-before-production");
export async function createSession(user: { id: string; email: string; name: string }) { return new SignJWT({ email: user.email, name: user.name }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("7d").sign(key); }
export async function readSession(token?: string) { if (!token) return null; try { return await jwtVerify(token, key); } catch { return null; } }

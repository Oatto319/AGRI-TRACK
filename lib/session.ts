import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { Role } from "./users";

// session แบบ cookie ที่เซิร์ฟเวอร์เซ็นลายเซ็น (HMAC-SHA256) — ฝั่งเบราว์เซอร์แก้ role เองไม่ได้
// ตั้งค่า AUTH_SECRET ใน .env.local (สุ่มยาว ๆ อย่างน้อย 32 ตัวอักษร) · ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
// token นี้ตรวจได้เฉพาะลายเซ็น+วันหมดอายุ (ใช้ใน proxy.ts) · การตรวจว่ายังไม่ถูกเพิกถอนทำใน lib/auth.ts (requireSession) โดยดู sid ในฐานข้อมูล
export const SESSION_COOKIE = "agri_session";
export const SESSION_MAX_AGE = 12 * 60 * 60; // วินาที (12 ชั่วโมง)
export interface TokenData { sid: string; username: string; role: Role; district?: string; exp: number }

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("ยังไม่ได้ตั้งค่า AUTH_SECRET (อย่างน้อย 16 ตัวอักษร) ใน .env.local — ดู .env.example");
  return s;
}
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function makeToken(d: Omit<TokenData, "exp">, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...d, exp: Math.floor(now / 1000) + SESSION_MAX_AGE })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseToken(token: string | undefined, now = Date.now()): TokenData | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<TokenData>;
    if (typeof d.exp !== "number" || d.exp < now / 1000) return null;
    if (d.role !== "province" && d.role !== "district") return null;
    if (typeof d.sid !== "string" || !d.sid || typeof d.username !== "string" || !d.username) return null;
    return { sid: d.sid, username: d.username, role: d.role, exp: d.exp, ...(d.district ? { district: d.district } : {}) };
  } catch { return null; }
}

export const readSession = (req: NextRequest): TokenData | null => parseToken(req.cookies.get(SESSION_COOKIE)?.value);

export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE };

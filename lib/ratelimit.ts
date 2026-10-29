import { db } from "./mongo";

// จำกัดจำนวนครั้งที่ล็อกอินผิด ต่อชื่อผู้ใช้และต่อ IP — เก็บในคอลเลกชัน login_attempts (มี TTL index ลบเองเมื่อหมดเวลา)
export const LIMITS = { user: 5, ip: 30, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
interface Attempt { _id: string; count: number; windowStart: number; lockedUntil?: number; expireAt: Date }
const col = async () => (await db()).collection<Attempt>("login_attempts");

export const clientIp = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"; // ใช้ได้เมื่ออยู่หลัง reverse proxy ที่เชื่อถือได้

/** คืนจำนวนวินาทีที่ยังถูกล็อก (0 = ไม่ถูกล็อก) */
export async function lockedSeconds(keys: string[], now = Date.now()): Promise<number> {
  const c = await col(); let max = 0;
  for (const k of keys) {
    const d = await c.findOne({ _id: k });
    if (d?.lockedUntil && d.lockedUntil > now) max = Math.max(max, Math.ceil((d.lockedUntil - now) / 1000));
  }
  return max;
}

export async function recordFailure(key: string, limit: number, now = Date.now()) {
  const c = await col();
  const d = await c.findOne({ _id: key });
  if (d && d.windowStart + LIMITS.windowMs < now && !(d.lockedUntil && d.lockedUntil > now)) await c.deleteOne({ _id: key }); // หมดช่วงนับแล้ว เริ่มใหม่
  await c.updateOne({ _id: key }, { $inc: { count: 1 }, $setOnInsert: { windowStart: now }, $set: { expireAt: new Date(now + LIMITS.windowMs + LIMITS.lockMs) } }, { upsert: true });
  const after = await c.findOne({ _id: key });
  if (after && after.count >= limit && !(after.lockedUntil && after.lockedUntil > now)) await c.updateOne({ _id: key }, { $set: { lockedUntil: now + LIMITS.lockMs } });
}
export async function clearFailures(key: string) { await (await col()).deleteOne({ _id: key }); }

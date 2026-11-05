import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
import { LIMITS, clearFailures, clientIp, lockedSeconds, recordFailure } from "@/lib/ratelimit";
import { SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, makeToken } from "@/lib/session";
import { createSession, newSid, verifyAccountLogin } from "@/lib/users";

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number, extra: Record<string, string> = {}) => NextResponse.json({ error }, { status, headers: { ...noStore, ...extra } });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("คำขอไม่ถูกต้อง", 403);
  let body: unknown;
  try { body = await req.json(); } catch { return fail("ข้อมูลไม่ถูกต้อง", 400); }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof b.account !== "string" || !b.account || typeof b.password !== "string" || !b.password) return fail("เลือกหน่วยงานและกรอกรหัสผ่านให้ครบ", 400);
  if (b.password.length > 128) return fail("รหัสผ่านไม่ถูกต้อง", 401);

  const iKey = `ip:${clientIp(req.headers)}`;
  try {
    const wait = await lockedSeconds([iKey]);
    if (wait > 0) return fail(`ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารออีกประมาณ ${Math.ceil(wait / 60)} นาที แล้วลองใหม่`, 429, { "Retry-After": String(wait) });

    const user = await verifyAccountLogin(b.account, b.password);
    if (!user) {
      await recordFailure(iKey, LIMITS.ip);
      return fail("รหัสผ่านไม่ถูกต้อง หรือบัญชีไม่สามารถเข้าสู่ระบบได้", 401);
    }
    await clearFailures(iKey);
    const sid = newSid();
    await createSession(sid, user.username, new Date(Date.now() + SESSION_MAX_AGE * 1000));
    const res = NextResponse.json({ role: user.role, ...(user.district ? { district: user.district } : {}), mustChange: user.mustChange }, { headers: noStore });
    res.cookies.set(SESSION_COOKIE, makeToken({ sid, username: user.username, role: user.role, ...(user.district ? { district: user.district } : {}) }), cookieOptions);
    return res;
  } catch (e) {
    console.error("[login]", e); // รายละเอียดจริงดูได้ใน log ฝั่งเซิร์ฟเวอร์ ไม่ส่งให้ผู้ใช้ (กันข้อมูลภายในรั่ว)
    return fail("เข้าสู่ระบบไม่สำเร็จ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ให้แจ้งผู้ดูแลระบบ", 500);
  }
}

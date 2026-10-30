import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { LIMITS, clearFailures, lockedSeconds, recordFailure } from "@/lib/ratelimit";
import { UserError, changePassword } from "@/lib/users";

// ผู้ใช้เปลี่ยนรหัสผ่านของตัวเอง (บัญชีที่ถูกบังคับให้เปลี่ยนรหัสก็เรียกได้)
export async function POST(req: NextRequest) {
  const a = await requireSession(req, { allowMustChange: true });
  if ("res" in a) return a.res;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  // กันเดารหัสผ่านเดิมซ้ำ ๆ ด้วย session ที่ถูกขโมย (นับแยกจากการล็อกอิน เพื่อไม่ล็อกบัญชีเจ้าของ)
  const key = `pw:${a.session.username}`, wait = await lockedSeconds([key]);
  if (wait > 0) return NextResponse.json({ error: `ลองผิดหลายครั้งเกินไป กรุณารอ ${Math.ceil(wait / 60)} นาทีแล้วลองใหม่` }, { status: 429, headers: { "Retry-After": String(wait) } });
  try {
    await changePassword(a.session.username, b.current, b.next, a.session.sid);
    await clearFailures(key);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof UserError) { if (e.status === 403) await recordFailure(key, LIMITS.user); return NextResponse.json({ error: e.message }, { status: e.status }); }
    console.error("[password]", e);
    return NextResponse.json({ error: "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

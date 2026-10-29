import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "./session";
import { getUser, sessionExists, type Role } from "./users";

export interface AuthSession { username: string; role: Role; district?: string; mustChange: boolean; sid: string }

const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

// หมายเหตุ: catch ด้านล่างต้อง unstable_rethrow — การอ่าน cookie ตอน Next.js พยายาม prerender จะโยนสัญญาณภายในที่ต้องปล่อยผ่าน ไม่ใช่ error จริง

// กัน CSRF: คำขอที่แก้ข้อมูลต้องมาจากเว็บเดียวกัน (ถ้ามี Origin ต้องตรงกับ Host) นอกเหนือจาก sameSite=lax ของ cookie
export function sameOrigin(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = req.headers.get("origin");
  if (!origin) return true; // เครื่องมือที่ไม่ใช่เบราว์เซอร์ (curl/ทดสอบ) ไม่ส่ง Origin
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}

/**
 * ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์: cookie ต้องเซ็นถูกต้อง + session ยังอยู่ในฐานข้อมูล (ออกจากระบบ/ปิดบัญชี/รีเซ็ตรหัสแล้วใช้ไม่ได้)
 * สิทธิ์ (role/อำเภอ) ใช้ค่าจากบัญชีในฐานข้อมูลเสมอ ไม่เชื่อค่าใน token
 * ใช้: const a = await requireSession(req); if ("res" in a) return a.res; → a.session
 * บัญชีที่ต้องเปลี่ยนรหัสผ่านก่อน (mustChange) ใช้ API อื่นไม่ได้ ยกเว้นส่ง allowMustChange: true
 */
export async function requireSession(req: NextRequest, opts: { allowMustChange?: boolean } = {}): Promise<{ session: AuthSession } | { res: NextResponse }> {
  if (!sameOrigin(req)) return { res: json("คำขอไม่ถูกต้อง", 403) };
  let token;
  try { token = readSession(req); } catch (e) { unstable_rethrow(e); console.error("[auth]", e); return { res: json("ระบบยืนยันตัวตนยังตั้งค่าไม่ครบ กรุณาติดต่อผู้ดูแลระบบ", 500) }; }
  if (!token) return { res: json("กรุณาเข้าสู่ระบบใหม่", 401) };
  try {
    const [alive, user] = await Promise.all([sessionExists(token.sid, token.username), getUser(token.username)]);
    if (!alive || !user || !user.active) return { res: json("กรุณาเข้าสู่ระบบใหม่", 401) };
    if (user.mustChange && !opts.allowMustChange) return { res: json("ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน", 403) };
    return { session: { username: user.username, role: user.role, ...(user.district ? { district: user.district } : {}), mustChange: user.mustChange, sid: token.sid } };
  } catch (e) { unstable_rethrow(e); console.error("[auth]", e); return { res: json("ตรวจสิทธิ์ไม่ได้ กรุณาลองใหม่อีกครั้ง", 500) }; }
}

export const forbidden = (message: string) => json(message, 403);

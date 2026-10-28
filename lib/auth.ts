import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "./session";
import type { Session } from "./users";

// ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์จาก cookie ที่เซ็นลายเซ็นไว้ (แก้ localStorage ในเบราว์เซอร์ไม่มีผล)
// ใช้: const a = requireSession(req); if ("res" in a) return a.res; → a.session
export function requireSession(req: NextRequest): { session: Session } | { res: NextResponse } {
  let session: Session | null;
  try { session = readSession(req); } catch (e) { return { res: NextResponse.json({ error: e instanceof Error ? e.message : "ตรวจสิทธิ์ไม่ได้" }, { status: 500 }) }; }
  if (!session) return { res: NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 }) };
  return { session };
}

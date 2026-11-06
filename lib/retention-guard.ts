import { NextResponse } from "next/server";
import { lockedStatus } from "./archive";
import type { Role } from "./users";

/** ใช้ที่ต้นของทุก API ที่บันทึกข้อมูล: ถ้าระบบถูกล็อกเพราะยังไม่ export ข้อมูลที่หลุดกรอบ 5 ปี คืน HTTP 423 พร้อมข้อความ (ไม่ล็อก = คืน null) */
export async function writeLock(role: Role): Promise<NextResponse | null> {
  const s = await lockedStatus();
  if (!s) return null;
  const error = role === "province"
    ? `${s.message} — ไปที่เมนู "สำรองข้อมูล" เพื่อ export`
    : `ระบบหยุดรับรายงานชั่วคราว เพราะต้องสำรองข้อมูลปีงบประมาณ ${s.blocking.join(", ")} ก่อน กรุณาแจ้งเจ้าหน้าที่จังหวัด แล้วลองใหม่ภายหลัง`;
  return NextResponse.json({ error, locked: true }, { status: 423, headers: { "Cache-Control": "no-store" } });
}

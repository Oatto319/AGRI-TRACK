import { NextResponse } from "next/server";
import { lockedStatus } from "./archive";
import type { Role } from "./users";

/** ใช้ที่ต้นของทุก API ที่บันทึกข้อมูล: คืน 423 เมื่อล็อก, 500 เมื่อตรวจสถานะไม่ได้, หรือ null เมื่อเขียนได้ */
export async function writeLock(role: Role): Promise<NextResponse | null> {
  let s: Awaited<ReturnType<typeof lockedStatus>>;
  try {
    s = await lockedStatus();
  } catch (e) {
    console.error("[retention-guard]", e);
    return NextResponse.json({ error: "ตรวจสถานะการเก็บข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  if (!s) return null;
  const error = role === "province"
    ? `${s.message} — ไปที่เมนู "สำรองข้อมูล" เพื่อ export`
    : `ระบบหยุดรับรายงานชั่วคราว เพราะต้องสำรองข้อมูลปีงบประมาณ ${s.blocking.join(", ")} ก่อน กรุณาแจ้งเจ้าหน้าที่จังหวัด แล้วลองใหม่ภายหลัง`;
  return NextResponse.json({ error, locked: true }, { status: 423, headers: { "Cache-Control": "no-store" } });
}
